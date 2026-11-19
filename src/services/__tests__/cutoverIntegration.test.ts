import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MigrationGate, evaluateMigrationState } from '../../components/auth/MigrationGate';
import * as migrationService from '../migrationService';
import { MigrationService } from '../migrationService';
import { bookmarkRepository } from '../bookmarkService';
import { collectionRepository } from '../collectionService';
import { tagRepository } from '../tagService';
import { SupabaseBookmarkRepository } from '../supabaseBookmarkRepository';
import { SupabaseCollectionRepository } from '../supabaseCollectionRepository';
import { SupabaseTagRepository } from '../supabaseTagRepository';
import { BookmarkProvider, useBookmarks } from '../../context/BookmarkContext';
import type { Bookmark } from '../../types';

// Mutable mock auth state
let mockAuth = {
  user: { id: 'test_user_cutover' } as { id: string; email?: string } | null,
  isLoading: false,
  isPasswordRecovery: false,
};

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockAuth.user,
    isLoading: mockAuth.isLoading,
    isPasswordRecovery: mockAuth.isPasswordRecovery,
  }),
}));

describe('Stage 5.4 Increment 4: Safe Cutover Reconciliation & Supabase Repository Switch Suite', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockAuth = {
      user: { id: 'test_user_cutover' },
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

  const renderGate = async (fallback?: React.ReactNode) => {
    const child = React.createElement('div', { 'data-testid': 'cloud-app' }, 'Cloud App Accessible');
    await act(async () => {
      root.render(
        fallback
          ? React.createElement(MigrationGate, { fallback, children: child })
          : React.createElement(MigrationGate, { children: child })
      );
    });
  };

  // Scenario 1: Existing migration marker is true, but cutover marker is absent: migration runs with force: true
  it('1. triggers forced reconciliation when migration marker is true but cutover marker is absent', async () => {
    const userId = 'user_reconcile_1';
    mockAuth.user = { id: userId };

    localStorage.setItem(`shelf_migrated_v1_${userId}`, 'true');
    // cutover marker is absent: shelf_cutover_v1_${userId} is null

    const migrateSpy = vi.spyOn(migrationService, 'migrateUserData').mockResolvedValue({
      state: 'completed',
      userId,
      report: { collectionsMigrated: 0, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 0, bookmarksSkipped: 0, warnings: [], errors: [] },
    });

    await renderGate();

    expect(migrateSpy).toHaveBeenCalledWith(userId, {
      force: true,
      onProgress: expect.any(Function),
    });
    expect(container.textContent).toContain('Cloud App Accessible');
    expect(localStorage.getItem(`shelf_cutover_v1_${userId}`)).toBe('true');
  });

  // Scenario 2: Local changes created after the original migration are uploaded to Supabase during cutover
  it('2. uploads local changes created after original migration during cutover reconciliation', async () => {
    const userId = 'user_post_migration_changes';
    const localBookmarks = [
      {
        id: 'bm_post_mig_1',
        url: 'https://example.com/post-migration',
        title: 'Post Migration Title',
        createdAt: '2026-11-19T08:00:00.000Z',
        updatedAt: '2026-11-19T08:30:00.000Z',
      },
    ];
    localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify(localBookmarks));
    localStorage.setItem(`shelf_migrated_v1_${userId}`, 'true');

    const rpcCalls: any[] = [];
    const storedBookmarks: any[] = [];

    const mockClient: any = {
      from: vi.fn((table: string) => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: any) => {
            if (table === 'bookmarks') {
              resolve({ data: storedBookmarks, error: null });
            } else {
              resolve({ data: [], error: null });
            }
          }),
        };
        return builder;
      }),
      rpc: vi.fn((fnName: string, args: any) => {
        rpcCalls.push({ fnName, args });
        if (fnName === 'save_bookmark_with_tags') {
          storedBookmarks.push({
            id: args.p_bookmark.id,
            url: args.p_bookmark.url,
            collection_id: args.p_bookmark.collectionId,
            updated_at: args.p_bookmark.updatedAt,
          });
        }
        return Promise.resolve({ data: args.p_bookmark?.id, error: null });
      }),
    };

    const service = new MigrationService(mockClient);
    const result = await service.migrateUserData(userId, { force: true });

    expect(result.state).toBe('completed');
    expect(result.report.bookmarksMigrated).toBe(1);
    expect(rpcCalls.length).toBe(1);
    expect(rpcCalls[0].fnName).toBe('save_bookmark_with_tags');
    expect(rpcCalls[0].args.p_bookmark.id).toBe('bm_post_mig_1');
    expect(rpcCalls[0].args.p_bookmark.title).toBe('Post Migration Title');
  });

  // Scenario 3: Existing newer cloud records are preserved according to the migration service's conflict rules
  it('3. preserves existing newer cloud records over older local records during reconciliation', async () => {
    const userId = 'user_conflict_rules';
    // Local collection has older updated_at
    const localCollections = [
      {
        id: 'col_shared',
        name: 'Local Outdated Name',
        color: 'blue',
        createdAt: '2026-11-18T10:00:00.000Z',
        updatedAt: '2026-11-18T12:00:00.000Z',
      },
    ];
    localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify(localCollections));

    // Cloud collection has newer updated_at
    const cloudCollections = [
      {
        id: 'col_shared',
        name: 'Cloud Newer Name',
        color: 'indigo',
        created_at: '2026-11-18T10:00:00.000Z',
        updated_at: '2026-11-19T09:00:00.000Z',
        user_id: userId,
      },
    ];

    const upsertCalls: any[] = [];
    const mockClient: any = {
      from: vi.fn((table: string) => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          upsert: vi.fn(async (payload: any) => {
            upsertCalls.push({ table, payload });
            return { data: payload, error: null };
          }),
          then: vi.fn((resolve: any) => {
            if (table === 'collections') {
              resolve({ data: cloudCollections, error: null });
            } else {
              resolve({ data: [], error: null });
            }
          }),
        };
        return builder;
      }),
    };

    const service = new MigrationService(mockClient);
    const result = await service.migrateUserData(userId, { force: true });

    expect(result.state).toBe('completed');
    // Because cloud record is newer (2026-11-19 vs 2026-11-18), local outdated version is skipped
    expect(upsertCalls.filter((c) => c.table === 'collections')).toHaveLength(0);
    expect(result.report.collectionsMigrated).toBe(0);
  });

  // Scenario 4: Empty local stores complete cutover safely and write the cutover marker
  it('4. safely completes cutover and writes cutover marker when local stores are empty', async () => {
    const userId = 'user_empty_stores';
    mockAuth.user = { id: userId };

    localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify([]));
    localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify([]));
    localStorage.setItem(`shelf_tags_${userId}`, JSON.stringify([]));

    const migrateSpy = vi.spyOn(migrationService, 'migrateUserData').mockResolvedValue({
      state: 'completed',
      userId,
      report: { collectionsMigrated: 0, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 0, bookmarksSkipped: 0, warnings: [], errors: [] },
    });

    await renderGate();

    expect(migrateSpy).toHaveBeenCalled();
    expect(localStorage.getItem(`shelf_cutover_v1_${userId}`)).toBe('true');
    expect(container.textContent).toContain('Cloud App Accessible');
  });

  // Scenario 5: Reconciliation returning needs_attention does NOT write the cutover marker and does NOT expose the cloud-backed application
  it('5. does not write cutover marker and blocks application access when reconciliation returns needs_attention', async () => {
    const userId = 'user_needs_att';
    mockAuth.user = { id: userId };

    vi.spyOn(migrationService, 'migrateUserData').mockResolvedValue({
      state: 'needs_attention',
      userId,
      report: {
        userId,
        timestamp: '2026-11-19T10:00:00.000Z',
        collectionsMigrated: 0,
        collectionsSkipped: 1,
        tagsMigrated: 0,
        tagsSkipped: 0,
        bookmarksMigrated: 0,
        bookmarksSkipped: 0,
        warnings: ['Skipped 1 collection due to invalid name'],
        errors: [],
      },
    });

    await renderGate();

    expect(localStorage.getItem(`shelf_cutover_v1_${userId}`)).toBeNull();
    expect(container.textContent).toContain('Migration Needs Attention');
    expect(container.textContent).not.toContain('Cloud App Accessible');
  });

  // Scenario 6: Acknowledging an attention report does NOT bypass the cutover requirement
  it('6. does not permit bypassing cutover requirement by acknowledging an attention report', async () => {
    const userId = 'user_ack_no_bypass';
    mockAuth.user = { id: userId };

    const attentionReport: migrationService.MigrationRecordReport = {
      userId,
      timestamp: '2026-11-19T10:00:00.000Z',
      collectionsMigrated: 1,
      collectionsSkipped: 1,
      tagsMigrated: 0,
      tagsSkipped: 0,
      bookmarksMigrated: 2,
      bookmarksSkipped: 1,
      warnings: ['Skipped invalid url'],
      errors: [],
    };

    // Acknowledge the report manually in localStorage
    localStorage.setItem(`shelf_migration_report_${userId}`, JSON.stringify(attentionReport));
    localStorage.setItem(`shelf_migration_acknowledged_${userId}`, '2026-11-19T10:00:00.000Z');

    // Invariant: evaluateMigrationState returns needs_attention because cutover marker is absent
    const evalState = evaluateMigrationState(userId);
    expect(evalState.state).toBe('needs_attention');
    expect(migrationService.isUserCutover(userId)).toBe(false);

    await renderGate();

    expect(container.textContent).toContain('Migration Needs Attention');
    expect(container.textContent).not.toContain('Cloud App Accessible');
    // Ensure no Proceed to Shelf button is present
    const proceedBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Proceed to Shelf'));
    expect(proceedBtn).toBeUndefined();
    expect(localStorage.getItem(`shelf_cutover_v1_${userId}`)).toBeNull();
  });

  // Scenario 7: Failed reconciliation does NOT write the cutover marker
  it('7. does not write cutover marker on failed reconciliation and displays failure screen', async () => {
    const userId = 'user_failed_reconciliation';
    mockAuth.user = { id: userId };

    vi.spyOn(migrationService, 'migrateUserData').mockResolvedValue({
      state: 'failed',
      userId,
      report: { collectionsMigrated: 0, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 0, bookmarksSkipped: 0, warnings: [], errors: ['Database timeout'] },
      error: 'Network connectivity lost during batch upload.',
    });

    await renderGate();

    expect(localStorage.getItem(`shelf_cutover_v1_${userId}`)).toBeNull();
    expect(container.textContent).toContain('Migration Failed');
    expect(container.textContent).toContain('Network connectivity lost during batch upload.');
    expect(container.textContent).not.toContain('Cloud App Accessible');
  });

  // Scenario 8: Cutover marker storage failure blocks access and presents a retry option
  it('8. blocks access and presents retry when cutover marker storage write fails verification', async () => {
    const userId = 'user_marker_failure';
    mockAuth.user = { id: userId };

    vi.spyOn(migrationService, 'migrateUserData').mockResolvedValue({
      state: 'completed',
      userId,
      report: { collectionsMigrated: 0, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 0, bookmarksSkipped: 0, warnings: [], errors: [] },
    });

    // Mock markUserCutover to fail
    vi.spyOn(migrationService, 'markUserCutover').mockReturnValue({
      success: false,
      error: 'QuotaExceededError: storage write failed',
    });

    await renderGate();

    expect(container.textContent).toContain('Migration Failed');
    expect(container.textContent).toContain('QuotaExceededError: storage write failed');
    expect(container.textContent).toContain('Retry Migration');
    expect(container.textContent).not.toContain('Cloud App Accessible');
  });

  // Scenario 9: Successful reconciliation writes the cutover marker and transitions to the cloud application
  it('9. writes verified cutover marker and transitions to cloud application upon successful reconciliation', async () => {
    const userId = 'user_success_cutover';
    mockAuth.user = { id: userId };

    vi.spyOn(migrationService, 'migrateUserData').mockResolvedValue({
      state: 'completed',
      userId,
      report: { collectionsMigrated: 3, collectionsSkipped: 0, tagsMigrated: 2, tagsSkipped: 0, bookmarksMigrated: 5, bookmarksSkipped: 0, warnings: [], errors: [] },
    });

    await renderGate();

    expect(localStorage.getItem(`shelf_cutover_v1_${userId}`)).toBe('true');
    expect(container.textContent).toContain('Cloud App Accessible');
  });

  // Scenario 10: Subsequent logins with a valid cutover marker skip reconciliation entirely
  it('10. skips reconciliation entirely on subsequent logins when valid cutover marker is present', async () => {
    const userId = 'user_already_cutover';
    mockAuth.user = { id: userId };

    localStorage.setItem(`shelf_cutover_v1_${userId}`, 'true');
    const migrateSpy = vi.spyOn(migrationService, 'migrateUserData');

    await renderGate();

    expect(migrateSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Cloud App Accessible');
  });

  // Scenario 11: Account switching prevents stale reconciliation results from affecting another user
  it('11. prevents stale in-flight reconciliation results of one user from affecting another user account', async () => {
    const userA = 'user_switching_A';
    const userB = 'user_switching_B';
    mockAuth.user = { id: userA };

    let resolveUserA: any;
    vi.spyOn(migrationService, 'migrateUserData').mockImplementation((uid) => {
      if (uid === userA) {
        return new Promise((resolve) => {
          resolveUserA = resolve;
        });
      }
      return Promise.resolve({
        state: 'completed',
        userId: userB,
        report: { collectionsMigrated: 0, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 0, bookmarksSkipped: 0, warnings: [], errors: [] },
      });
    });

    localStorage.setItem(`shelf_cutover_v1_${userB}`, 'true');

    await renderGate();

    expect(container.textContent).toContain('Migrating Shelf to the Cloud');

    // Switch account to user B
    mockAuth.user = { id: userB };
    await renderGate();

    expect(container.textContent).toContain('Cloud App Accessible');

    // Stale user A finishes with failure
    await act(async () => {
      resolveUserA({
        state: 'failed',
        userId: userA,
        report: { collectionsMigrated: 0, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 0, bookmarksSkipped: 0, warnings: [], errors: ['Timeout'] },
        error: 'Stale error A',
      });
    });

    // Content remains accessible for user B without stale failure display
    expect(container.textContent).toContain('Cloud App Accessible');
    expect(container.textContent).not.toContain('Stale error A');
  });

  // Scenario 12: Signing out during reconciliation never exposes protected content
  it('12. prevents protected content from ever being exposed when user signs out during reconciliation', async () => {
    const userId = 'user_signing_out_cutover';
    mockAuth.user = { id: userId };

    let resolveMigration: any;
    vi.spyOn(migrationService, 'migrateUserData').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMigration = resolve;
        })
    );

    const fallback = React.createElement('div', { 'data-testid': 'signed-out' }, 'Signed Out Screen');
    await renderGate(fallback);

    expect(container.textContent).toContain('Migrating Shelf to the Cloud');

    // Sign out
    mockAuth.user = null;
    await renderGate(fallback);

    expect(container.textContent).toContain('Signed Out Screen');
    expect(container.textContent).not.toContain('Cloud App Accessible');

    // In-flight migration resolves completed
    await act(async () => {
      resolveMigration({
        state: 'completed',
        userId,
        report: { collectionsMigrated: 1, collectionsSkipped: 0, tagsMigrated: 0, tagsSkipped: 0, bookmarksMigrated: 1, bookmarksSkipped: 0, warnings: [], errors: [] },
      });
    });

    expect(container.textContent).toContain('Signed Out Screen');
    expect(container.textContent).not.toContain('Cloud App Accessible');
  });

  // Scenario 13: All three repositories return data from Supabase after cutover
  it('13. confirms all three exported repository singletons are Supabase implementations', async () => {
    expect(bookmarkRepository).toBeInstanceOf(SupabaseBookmarkRepository);
    expect(collectionRepository).toBeInstanceOf(SupabaseCollectionRepository);
    expect(tagRepository).toBeInstanceOf(SupabaseTagRepository);

    // Verify they call Supabase queries
    const mockClient: any = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: any) => resolve({ data: [], error: null })),
      })),
    };

    const supabaseBookmarkRepo = new SupabaseBookmarkRepository(mockClient);
    const supabaseCollectionRepo = new SupabaseCollectionRepository(mockClient);
    const supabaseTagRepo = new SupabaseTagRepository(mockClient);

    const bmData = await supabaseBookmarkRepo.getBookmarks('user_test');
    const colData = await supabaseCollectionRepo.getCollections('user_test');
    const tagData = await supabaseTagRepo.getTags('user_test');

    expect(Array.isArray(bmData)).toBe(true);
    expect(Array.isArray(colData)).toBe(true);
    expect(Array.isArray(tagData)).toBe(true);
    expect(mockClient.from).toHaveBeenCalledWith('bookmarks');
    expect(mockClient.from).toHaveBeenCalledWith('collections');
    expect(mockClient.from).toHaveBeenCalledWith('tags');
  });

  // Scenario 14: Repository mutations (add, update, delete) write to Supabase and do NOT write to localStorage
  it('14. verifies repository mutations write to Supabase and do not write to localStorage', async () => {
    const userId = 'user_mutations_test';
    const mockClient: any = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'col_cloud_new',
            user_id: userId,
            name: 'Cloud Collection',
            color: 'blue',
            created_at: '2026-11-19T10:00:00.000Z',
            updated_at: '2026-11-19T10:00:00.000Z',
          },
          error: null,
        }),
        then: vi.fn((resolve: any) => resolve({ data: [], error: null })),
      })),
      rpc: vi.fn().mockResolvedValue({
        data: {
          id: 'bm_cloud_new',
          url: 'https://example.com/cloud',
          title: 'Cloud Bookmark',
          domain: 'example.com',
          is_favourite: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          bookmark_tags: [],
        },
        error: null,
      }),
    };

    const repoCol = new SupabaseCollectionRepository(mockClient);
    const repoBm = new SupabaseBookmarkRepository(mockClient);

    await repoCol.createCollection(userId, { name: 'Cloud Collection', color: 'blue' });
    await repoBm.addBookmark(userId, {
      url: 'https://example.com/cloud',
      title: 'Cloud Bookmark',
    });

    // Invariant: localStorage collections and bookmarks are NOT written by Supabase repositories
    expect(localStorage.getItem(`shelf_collections_${userId}`)).toBeNull();
    expect(localStorage.getItem(`shelf_bookmarks_${userId}`)).toBeNull();
    expect(mockClient.from).toHaveBeenCalledWith('collections');
    expect(mockClient.rpc).toHaveBeenCalledWith('save_bookmark_with_tags', expect.any(Object));
  });

  // Scenario 15: Local migration data and backups remain untouched after cutover
  it('15. verifies local migration data and backups remain completely untouched after cutover', async () => {
    const userId = 'user_backup_retention';
    const originalBackup = {
      timestamp: '2026-11-18T12:00:00.000Z',
      collections: [{ id: 'col_old', name: 'Original Backup Name' }],
      tags: [],
      bookmarks: [],
    };
    const backupKey = `shelf_migration_backup_${userId}`;
    const reportKey = `shelf_migration_report_${userId}`;

    localStorage.setItem(backupKey, JSON.stringify(originalBackup));
    localStorage.setItem(reportKey, JSON.stringify({ userId, collectionsMigrated: 1 }));

    // Perform operations through repository
    const mockClient: any = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: any) => resolve({ data: [], error: null })),
      })),
    };
    const repo = new SupabaseTagRepository(mockClient);
    await repo.getTags(userId);

    // Invariant: local backup and report in localStorage are untouched
    expect(localStorage.getItem(backupKey)).toBe(JSON.stringify(originalBackup));
    expect(localStorage.getItem(reportKey)).toContain(userId);
  });

  // Scenario 16: Network errors during repository operations remain visible through context loadError and retryLoad behaviour
  it('16. surfaces network errors via context loadError and supports retryLoad', async () => {
    let capturedContext: any;
    const TestConsumer: React.FC = () => {
      capturedContext = useBookmarks();
      return React.createElement('div', null, 'Context Rendered');
    };

    let fetchCount = 0;
    const getBookmarksSpy = vi.spyOn(bookmarkRepository, 'getBookmarks').mockImplementation(async () => {
      fetchCount++;
      if (fetchCount === 1) {
        throw new Error('Supabase Cloud Connection Failed');
      }
      return [
        {
          id: 'bm_recovered',
          url: 'https://example.com/recovered',
          title: 'Recovered Bookmark',
          domain: 'example.com',
          collectionId: undefined,
          collectionName: undefined,
          tags: [],
          isFavourite: false,
          createdAt: '2026-11-19T00:00:00.000Z',
        },
      ];
    });

    await act(async () => {
      root.render(
        React.createElement(BookmarkProvider, null, React.createElement(TestConsumer))
      );
    });

    // Initial load failed
    expect(capturedContext?.isLoading).toBe(false);
    expect(capturedContext?.loadError).toBeInstanceOf(Error);
    expect(capturedContext?.loadError?.message).toContain('Supabase Cloud Connection Failed');
    expect(capturedContext?.bookmarks).toEqual([]);

    // Call retryLoad()
    await act(async () => {
      capturedContext?.retryLoad();
    });

    // Error is cleared and data is populated
    expect(capturedContext?.loadError).toBeNull();
    expect(capturedContext?.bookmarks.length).toBe(1);
    expect(capturedContext?.bookmarks[0].id).toBe('bm_recovered');
    expect(getBookmarksSpy).toHaveBeenCalledTimes(2);
  });

  // Scenario 17: Bookmark/tag relationships and collection assignments remain correct after cloud loading
  it('17. maps cloud bookmark/tag relationships and collection assignments accurately into context', async () => {
    let capturedContext: any;
    const TestConsumer: React.FC = () => {
      capturedContext = useBookmarks();
      return React.createElement('div', null, 'Context Rendered');
    };

    const cloudBookmarks: Bookmark[] = [
      {
        id: 'bm_rel_1',
        url: 'https://react.dev',
        title: 'React Documentation',
        domain: 'react.dev',
        collectionId: 'col_dev_101',
        collectionName: 'Development',
        tags: ['tag_react', 'tag_frontend'],
        isFavourite: true,
        createdAt: '2026-11-19T10:00:00.000Z',
        updatedAt: '2026-11-19T10:30:00.000Z',
      },
    ];

    vi.spyOn(bookmarkRepository, 'getBookmarks').mockResolvedValue(cloudBookmarks);

    await act(async () => {
      root.render(
        React.createElement(BookmarkProvider, null, React.createElement(TestConsumer))
      );
    });

    expect(capturedContext?.isLoading).toBe(false);
    expect(capturedContext?.loadError).toBeNull();
    expect(capturedContext?.bookmarks.length).toBe(1);

    const loadedBm = capturedContext?.bookmarks[0];
    expect(loadedBm?.id).toBe('bm_rel_1');
    expect(loadedBm?.collectionId).toBe('col_dev_101');
    expect(loadedBm?.collectionName).toBe('Development');
    expect(loadedBm?.tags).toEqual(['tag_react', 'tag_frontend']);
    expect(loadedBm?.isFavourite).toBe(true);
  });
});
