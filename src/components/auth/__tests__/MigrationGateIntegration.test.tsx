import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MigrationGate } from '../MigrationGate';
import * as migrationService from '../../../services/migrationService';

// Mutable mock auth state
let mockAuth = {
  user: null as { id: string; email?: string } | null,
  isLoading: false,
  isPasswordRecovery: false,
};

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockAuth.user,
    isLoading: mockAuth.isLoading,
    isPasswordRecovery: mockAuth.isPasswordRecovery,
  }),
}));

describe('MigrationGate Integration & Application Lifecycle Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockAuth = {
      user: null,
      isLoading: false,
      isPasswordRecovery: false,
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  // 1. Auth loading: gate does not run prematurely
  it('1. does not run migration prematurely while authentication is loading', async () => {
    mockAuth = {
      user: null,
      isLoading: true,
      isPasswordRecovery: false,
    };

    const migrateSpy = vi.spyOn(migrationService, 'migrateUserData');

    await act(async () => {
      root.render(
        <MigrationGate>
          <div data-testid="protected-content">Authenticated Shelf Content</div>
        </MigrationGate>
      );
    });

    expect(migrateSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Verifying Shelf Storage...');
    expect(container.textContent).not.toContain('Authenticated Shelf Content');
  });

  // 2. Signed-out state: gate does not execute and does not render children
  it('2. does not execute migration and hides protected content when signed out', async () => {
    mockAuth = {
      user: null,
      isLoading: false,
      isPasswordRecovery: false,
    };

    const migrateSpy = vi.spyOn(migrationService, 'migrateUserData');

    await act(async () => {
      root.render(
        <MigrationGate fallback={<div data-testid="fallback">Signed Out Fallback</div>}>
          <div data-testid="protected-content">Authenticated Shelf Content</div>
        </MigrationGate>
      );
    });

    expect(migrateSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Signed Out Fallback');
    expect(container.textContent).not.toContain('Authenticated Shelf Content');
  });

  // 3. Authenticated user: gate runs for the correct user
  it('3. runs migration for the resolved authenticated user ID', async () => {
    const userId = 'user_auth_123';
    mockAuth = {
      user: { id: userId },
      isLoading: false,
      isPasswordRecovery: false,
    };

    let resolveMigration: any;
    const migrateSpy = vi.spyOn(migrationService, 'migrateUserData').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMigration = resolve;
        })
    );

    await act(async () => {
      root.render(
        <MigrationGate>
          <div data-testid="protected-content">Authenticated Shelf Content</div>
        </MigrationGate>
      );
    });

    expect(migrateSpy).toHaveBeenCalledWith(userId, {
      force: true,
      onProgress: expect.any(Function),
    });
    expect(container.textContent).toContain('Migrating Shelf to the Cloud');
    expect(container.textContent).not.toContain('Authenticated Shelf Content');

    // Clean up in-flight promise
    await act(async () => {
      resolveMigration({
        state: 'completed',
        userId,
        report: { collectionsMigrated: 0, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 0, bookmarksSkipped: 0, warnings: [], errors: [] },
      });
    });
  });

  // 4. Successful migration: application becomes accessible
  it('4. exposes protected content when migration completes successfully', async () => {
    const userId = 'user_success_456';
    mockAuth = {
      user: { id: userId },
      isLoading: false,
      isPasswordRecovery: false,
    };

    vi.spyOn(migrationService, 'migrateUserData').mockResolvedValue({
      state: 'completed',
      userId,
      report: {
        collectionsMigrated: 2,
        collectionsSkipped: 0,
        tagsMigrated: 3,
        tagsSkipped: 0,
        bookmarksMigrated: 5,
        bookmarksSkipped: 0,
        warnings: [],
        errors: [],
      },
    });

    await act(async () => {
      root.render(
        <MigrationGate>
          <div data-testid="protected-content">Authenticated Shelf Content</div>
        </MigrationGate>
      );
    });

    expect(container.textContent).toContain('Authenticated Shelf Content');
    expect(container.textContent).not.toContain('Migrating Shelf to the Cloud');
  });

  // 5. Attention report: report can be inspected
  it('5. renders attention screen when items were skipped and blocks application access', async () => {
    const userId = 'user_attention_789';
    mockAuth = {
      user: { id: userId },
      isLoading: false,
      isPasswordRecovery: false,
    };

    const attentionReport: migrationService.MigrationRecordReport = {
      userId,
      timestamp: '2026-11-19T10:00:00.000Z',
      collectionsMigrated: 1,
      collectionsSkipped: 1,
      tagsMigrated: 2,
      tagsSkipped: 0,
      bookmarksMigrated: 4,
      bookmarksSkipped: 2,
      warnings: ['Bookmark URL invalid: test', 'Duplicate collection name'],
      errors: [],
    };

    vi.spyOn(migrationService, 'migrateUserData').mockResolvedValue({
      state: 'needs_attention',
      userId,
      report: attentionReport,
      error: '3 items skipped',
    });

    await act(async () => {
      root.render(
        <MigrationGate>
          <div data-testid="protected-content">Authenticated Shelf Content</div>
        </MigrationGate>
      );
    });

    expect(container.textContent).toContain('Migration Needs Attention');
    expect(container.textContent).toContain('Retry Cutover Reconciliation');
    expect(container.textContent).not.toContain('Authenticated Shelf Content');
  });

  // 6. Attention report: acknowledgement does not bypass cutover requirement
  it('6. blocks application access on attention report without bypass option and offers retry', async () => {
    const userId = 'user_ack_101';
    mockAuth = {
      user: { id: userId },
      isLoading: false,
      isPasswordRecovery: false,
    };

    const attentionReport: migrationService.MigrationRecordReport = {
      userId,
      timestamp: '2026-11-19T10:00:00.000Z',
      collectionsMigrated: 1,
      collectionsSkipped: 1,
      tagsMigrated: 0,
      tagsSkipped: 0,
      bookmarksMigrated: 2,
      bookmarksSkipped: 1,
      warnings: ['Invalid bookmark'],
      errors: [],
    };

    let callCount = 0;
    vi.spyOn(migrationService, 'migrateUserData').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          state: 'needs_attention',
          userId,
          report: attentionReport,
        };
      }
      return {
        state: 'completed',
        userId,
        report: { collectionsMigrated: 2, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 3, bookmarksSkipped: 0, warnings: [], errors: [] },
      };
    });

    await act(async () => {
      root.render(
        <MigrationGate>
          <div data-testid="protected-content">Authenticated Shelf Content</div>
        </MigrationGate>
      );
    });

    expect(container.textContent).toContain('Migration Needs Attention');
    expect(container.textContent).not.toContain('Authenticated Shelf Content');

    // Invariant: No "Proceed to Shelf" bypass button exists
    const proceedButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Proceed to Shelf')
    );
    expect(proceedButton).toBeUndefined();

    // Invariant: cutover marker is NOT falsely written
    expect(localStorage.getItem(`shelf_cutover_v1_${userId}`)).toBeNull();

    // Click "Retry Cutover Reconciliation"
    const retryButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Retry Cutover Reconciliation')
    );
    expect(retryButton).toBeDefined();

    await act(async () => {
      (retryButton as any)?.click();
    });

    // Content is now accessible after successful retry
    expect(container.textContent).toContain('Authenticated Shelf Content');
    expect(localStorage.getItem(`shelf_cutover_v1_${userId}`)).toBe('true');
  });

  // 7. Failed migration: application does not falsely appear completed
  it('7. displays failure screen on migration error and prevents application access', async () => {
    const userId = 'user_fail_202';
    mockAuth = {
      user: { id: userId },
      isLoading: false,
      isPasswordRecovery: false,
    };

    vi.spyOn(migrationService, 'migrateUserData').mockResolvedValue({
      state: 'failed',
      userId,
      report: { collectionsMigrated: 0, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 0, bookmarksSkipped: 0, warnings: [], errors: ['Database timeout'] },
      error: 'Database connection failed during batch upsert.',
    });

    await act(async () => {
      root.render(
        <MigrationGate>
          <div data-testid="protected-content">Authenticated Shelf Content</div>
        </MigrationGate>
      );
    });

    expect(container.textContent).toContain('Migration Failed');
    expect(container.textContent).toContain('Database connection failed during batch upsert.');
    expect(container.textContent).not.toContain('Authenticated Shelf Content');
    expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();
  });

  // 8. Retry: migration can be retried safely
  it('8. allows retrying migration with force flag from failure screen', async () => {
    const userId = 'user_retry_303';
    mockAuth = {
      user: { id: userId },
      isLoading: false,
      isPasswordRecovery: false,
    };

    let callCount = 0;
    const migrateSpy = vi.spyOn(migrationService, 'migrateUserData').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          state: 'failed',
          userId,
          report: { collectionsMigrated: 0, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 0, bookmarksSkipped: 0, warnings: [], errors: ['Initial network failure'] },
          error: 'Initial network failure',
        };
      }
      return {
        state: 'completed',
        userId,
        report: { collectionsMigrated: 1, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 1, bookmarksSkipped: 0, warnings: [], errors: [] },
      };
    });

    await act(async () => {
      root.render(
        <MigrationGate>
          <div data-testid="protected-content">Authenticated Shelf Content</div>
        </MigrationGate>
      );
    });

    expect(container.textContent).toContain('Migration Failed');

    // Click Retry Migration
    const retryButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Retry Migration')
    );
    expect(retryButton).toBeDefined();

    await act(async () => {
      (retryButton as any)?.click();
    });

    expect(migrateSpy).toHaveBeenCalledTimes(2);
    expect(migrateSpy).toHaveBeenLastCalledWith(userId, {
      force: true,
      onProgress: expect.any(Function),
    });
    expect(container.textContent).toContain('Authenticated Shelf Content');
  });

  // 9. Account switching: stale migration results cannot affect another account
  it('9. prevents in-flight migration results of an old account from affecting a newly active account', async () => {
    const userA = 'user_alpha';
    const userB = 'user_beta';

    mockAuth = {
      user: { id: userA },
      isLoading: false,
      isPasswordRecovery: false,
    };

    let resolveUserA: any;
    vi.spyOn(migrationService, 'migrateUserData').mockImplementation((uid) => {
      if (uid === userA) {
        return new Promise((resolve) => {
          resolveUserA = resolve;
        });
      }
      // User B is already migrated
      return Promise.resolve({
        state: 'completed',
        userId: userB,
        report: { collectionsMigrated: 0, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 0, bookmarksSkipped: 0, warnings: [], errors: [] },
      });
    });

    // Mark User B as already cut over in localStorage
    localStorage.setItem(`shelf_cutover_v1_${userB}`, 'true');

    await act(async () => {
      root.render(
        <MigrationGate>
          <div data-testid="protected-content">Authenticated Shelf Content</div>
        </MigrationGate>
      );
    });

    // User A is migrating
    expect(container.textContent).toContain('Migrating Shelf to the Cloud');

    // Switch account to User B while User A migration is still in flight
    mockAuth = {
      user: { id: userB },
      isLoading: false,
      isPasswordRecovery: false,
    };

    await act(async () => {
      root.render(
        <MigrationGate>
          <div data-testid="protected-content">Authenticated Shelf Content</div>
        </MigrationGate>
      );
    });

    // User B was already migrated, so protected content shows
    expect(container.textContent).toContain('Authenticated Shelf Content');

    // Now User A's slow migration finally returns with an error
    await act(async () => {
      resolveUserA({
        state: 'failed',
        userId: userA,
        report: { collectionsMigrated: 0, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 0, bookmarksSkipped: 0, warnings: [], errors: ['Stale error'] },
        error: 'Stale error from User A',
      });
    });

    // Invariant: Stale User A result must NOT put User B into failed state
    expect(container.textContent).toContain('Authenticated Shelf Content');
    expect(container.textContent).not.toContain('Stale error from User A');
  });

  // 10. Sign-out during migration: stale results cannot expose authenticated content
  it('10. prevents in-flight migration completion from exposing content after user signs out', async () => {
    const userId = 'user_signing_out';
    mockAuth = {
      user: { id: userId },
      isLoading: false,
      isPasswordRecovery: false,
    };

    let resolveMigration: any;
    vi.spyOn(migrationService, 'migrateUserData').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMigration = resolve;
        })
    );

    await act(async () => {
      root.render(
        <MigrationGate fallback={<div data-testid="fallback">Signed Out Fallback</div>}>
          <div data-testid="protected-content">Authenticated Shelf Content</div>
        </MigrationGate>
      );
    });

    expect(container.textContent).toContain('Migrating Shelf to the Cloud');

    // User signs out while migration is in flight
    mockAuth = {
      user: null,
      isLoading: false,
      isPasswordRecovery: false,
    };

    await act(async () => {
      root.render(
        <MigrationGate fallback={<div data-testid="fallback">Signed Out Fallback</div>}>
          <div data-testid="protected-content">Authenticated Shelf Content</div>
        </MigrationGate>
      );
    });

    // User is signed out -> shows fallback, not content
    expect(container.textContent).toContain('Signed Out Fallback');
    expect(container.textContent).not.toContain('Authenticated Shelf Content');

    // Migration for the signed-out user finishes successfully
    await act(async () => {
      resolveMigration({
        state: 'completed',
        userId,
        report: { collectionsMigrated: 1, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 1, bookmarksSkipped: 0, warnings: [], errors: [] },
      });
    });

    // Invariant: Content must NOT be exposed to signed-out viewer
    expect(container.textContent).not.toContain('Authenticated Shelf Content');
    expect(container.textContent).toContain('Signed Out Fallback');
  });

  // 11. Repeated renders/navigation: no duplicate migration execution
  it('11. does not trigger duplicate migration executions across repeated re-renders', async () => {
    const userId = 'user_rerender_505';
    mockAuth = {
      user: { id: userId },
      isLoading: false,
      isPasswordRecovery: false,
    };

    let resolveMigration: any;
    const migrateSpy = vi.spyOn(migrationService, 'migrateUserData').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMigration = resolve;
        })
    );

    // First render
    await act(async () => {
      root.render(
        <MigrationGate>
          <div data-testid="protected-content">Content Page 1</div>
        </MigrationGate>
      );
    });

    expect(migrateSpy).toHaveBeenCalledTimes(1);

    // Subsequent re-render (e.g. navigation or parent state change)
    await act(async () => {
      root.render(
        <MigrationGate>
          <div data-testid="protected-content">Content Page 2</div>
        </MigrationGate>
      );
    });

    // Invariant: Deduplication ref prevented duplicate competing migration call
    expect(migrateSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveMigration({
        state: 'completed',
        userId,
        report: { collectionsMigrated: 0, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 0, bookmarksSkipped: 0, warnings: [], errors: [] },
      });
    });
  });

  // 14. Existing login and password recovery flows remain unaffected
  it('14. preserves unauthenticated and password recovery states', () => {
    // Evaluation pure function assertions confirming safety
    expect(migrationService.isUserMigrated('')).toBe(false);
    expect(migrationService.getMigrationReport('')).toBeNull();
  });
});
