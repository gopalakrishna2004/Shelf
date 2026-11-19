import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateMigrationState,
} from '../MigrationGate';
import {
  acknowledgeMigrationReport,
  isMigrationAcknowledged,
  clearMigrationAcknowledgement,
  type MigrationRecordReport,
} from '../../../services/migrationService';

describe('MigrationGate & Acknowledgement Lifecycle Suite', () => {
  const userId = 'user_gate_test_456';
  const initialTimestamp = '2026-11-18T20:00:00.000Z';

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Migration Acknowledgement Service Functions', () => {
    it('persists exact report timestamp and returns success', () => {
      const result = acknowledgeMigrationReport(userId, initialTimestamp);

      expect(result.success).toBe(true);
      expect(localStorage.getItem(`shelf_migration_acknowledged_${userId}`)).toBe(initialTimestamp);
      expect(isMigrationAcknowledged(userId, initialTimestamp)).toBe(true);

      // Invariant: Never writes completion marker on acknowledgement
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();
    });

    it('requires valid non-empty userId and timestamp', () => {
      expect(acknowledgeMigrationReport('', initialTimestamp).success).toBe(false);
      expect(acknowledgeMigrationReport(userId, '').success).toBe(false);
    });

    it('handles localStorage exceptions (e.g. QuotaExceededError) safely and returns explicit error', () => {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
        if (key.startsWith('shelf_migration_acknowledged_')) {
          throw new Error('QuotaExceededError: Storage is full');
        }
        return originalSetItem(key, value);
      });

      const result = acknowledgeMigrationReport(userId, initialTimestamp);
      expect(result.success).toBe(false);
      expect(result.error).toContain('QuotaExceededError');
      expect(isMigrationAcknowledged(userId, initialTimestamp)).toBe(false);
    });

    it('acknowledgement requires exact timestamp match', () => {
      acknowledgeMigrationReport(userId, initialTimestamp);

      expect(isMigrationAcknowledged(userId, initialTimestamp)).toBe(true);
      // Different timestamp (e.g. from subsequent retry) must NOT be acknowledged
      const newerTimestamp = '2026-11-18T22:30:00.000Z';
      expect(isMigrationAcknowledged(userId, newerTimestamp)).toBe(false);
    });

    it('clearMigrationAcknowledgement clears the acknowledged marker', () => {
      acknowledgeMigrationReport(userId, initialTimestamp);
      expect(isMigrationAcknowledged(userId, initialTimestamp)).toBe(true);

      clearMigrationAcknowledgement(userId);
      expect(isMigrationAcknowledged(userId, initialTimestamp)).toBe(false);
      expect(localStorage.getItem(`shelf_migration_acknowledged_${userId}`)).toBeNull();
    });
  });

  describe('2. MigrationGate State Evaluation Logic', () => {
    it('evaluates to completed immediately if user has completed authoritative cutover', () => {
      localStorage.setItem(`shelf_cutover_v1_${userId}`, 'true');

      const evaluation = evaluateMigrationState(userId);

      expect(evaluation.state).toBe('completed');
      expect(evaluation.shouldMigrate).toBe(false);
      expect(evaluation.report).toBeNull();
    });

    it('requires forced reconciliation when existing migration marker is true but cutover marker is absent', () => {
      // User completed Increment 3 migration, but has not completed Increment 4 cutover
      localStorage.setItem(`shelf_migrated_v1_${userId}`, 'true');
      expect(localStorage.getItem(`shelf_cutover_v1_${userId}`)).toBeNull();

      const evaluation = evaluateMigrationState(userId);

      // Must trigger reconciliation to sweep any local changes made after initial migration
      expect(evaluation.state).toBe('migrating');
      expect(evaluation.shouldMigrate).toBe(true);
    });

    it('evaluates to completed when userId is null/unauthenticated', () => {
      const evaluation = evaluateMigrationState(null);

      expect(evaluation.state).toBe('completed');
      expect(evaluation.shouldMigrate).toBe(false);
    });

    it('evaluates to migrating with shouldMigrate=true when user is unmigrated and has no report', () => {
      const evaluation = evaluateMigrationState(userId);

      expect(evaluation.state).toBe('migrating');
      expect(evaluation.shouldMigrate).toBe(true);
    });

    it('evaluates to needs_attention when persisted report has skipped records', () => {
      const report: MigrationRecordReport = {
        userId,
        timestamp: initialTimestamp,
        collectionsMigrated: 2,
        collectionsSkipped: 1,
        tagsMigrated: 3,
        tagsSkipped: 0,
        bookmarksMigrated: 5,
        bookmarksSkipped: 2,
        warnings: ['Skipped bookmark with invalid URL', 'Skipped duplicate collection'],
        errors: [],
      };
      localStorage.setItem(`shelf_migration_report_${userId}`, JSON.stringify(report));

      const evaluation = evaluateMigrationState(userId);

      expect(evaluation.state).toBe('needs_attention');
      expect(evaluation.shouldMigrate).toBe(false);
      expect(evaluation.report?.collectionsSkipped).toBe(1);
      expect(evaluation.report?.bookmarksSkipped).toBe(2);
      expect(evaluation.report?.warnings.length).toBe(2);
    });

    it('acknowledging an attention report does not bypass the cutover requirement', () => {
      const report: MigrationRecordReport = {
        userId,
        timestamp: initialTimestamp,
        collectionsMigrated: 1,
        collectionsSkipped: 1,
        tagsMigrated: 1,
        tagsSkipped: 0,
        bookmarksMigrated: 2,
        bookmarksSkipped: 1,
        warnings: ['Warning 1'],
        errors: [],
      };
      localStorage.setItem(`shelf_migration_report_${userId}`, JSON.stringify(report));
      localStorage.setItem(`shelf_migration_acknowledged_${userId}`, initialTimestamp);

      const evaluation = evaluateMigrationState(userId);

      // In Increment 4 cutover, unresolved skips block cloud application access
      expect(evaluation.state).toBe('needs_attention');
      expect(evaluation.shouldMigrate).toBe(false);
      expect(evaluation.report?.collectionsSkipped).toBe(1);
    });

    it('requires reconciliation retry when report has unresolved errors', () => {
      const failedReport: MigrationRecordReport = {
        userId,
        timestamp: initialTimestamp,
        collectionsMigrated: 0,
        collectionsSkipped: 0,
        tagsMigrated: 0,
        tagsSkipped: 0,
        bookmarksMigrated: 0,
        bookmarksSkipped: 0,
        warnings: [],
        errors: ['Database connection timeout during verification'],
      };
      localStorage.setItem(`shelf_migration_report_${userId}`, JSON.stringify(failedReport));

      const evaluation = evaluateMigrationState(userId);

      expect(evaluation.state).toBe('failed');
      expect(evaluation.errorMessage).toBe('Database connection timeout during verification');
      expect(evaluation.shouldMigrate).toBe(false);
    });
  });

  describe('3. Report and Backup Preservation', () => {
    it('acknowledgement preserves migration report and pre-migration backup in localStorage', () => {
      const report: MigrationRecordReport = {
        userId,
        timestamp: initialTimestamp,
        collectionsMigrated: 1,
        collectionsSkipped: 1,
        tagsMigrated: 1,
        tagsSkipped: 0,
        bookmarksMigrated: 1,
        bookmarksSkipped: 1,
        warnings: ['Warning'],
        errors: [],
      };
      const reportKey = `shelf_migration_report_${userId}`;
      const backupKey = `shelf_backup_v1_${userId}_1700000000000`;
      const localBmKey = `shelf_bookmarks_${userId}`;

      localStorage.setItem(reportKey, JSON.stringify(report));
      localStorage.setItem(backupKey, JSON.stringify({ bookmarks: [{ id: '1' }] }));
      localStorage.setItem(localBmKey, JSON.stringify([{ id: '1', url: 'https://test.com' }]));

      // Execute acknowledgement
      const ackResult = acknowledgeMigrationReport(userId, initialTimestamp);
      expect(ackResult.success).toBe(true);

      // Verify all items are preserved
      expect(localStorage.getItem(reportKey)).not.toBeNull();
      expect(localStorage.getItem(backupKey)).not.toBeNull();
      expect(localStorage.getItem(localBmKey)).not.toBeNull();
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();
    });

    it('clearing acknowledgement before deliberate retry preserves the existing report and backup', () => {
      const backupKey = `shelf_backup_v1_${userId}_1700000000000`;
      const reportKey = `shelf_migration_report_${userId}`;

      localStorage.setItem(backupKey, JSON.stringify({ bookmarks: [] }));
      localStorage.setItem(reportKey, JSON.stringify({ collectionsSkipped: 1 }));
      localStorage.setItem(`shelf_migration_acknowledged_${userId}`, initialTimestamp);

      // Simulate retry start
      clearMigrationAcknowledgement(userId);

      // Acknowledgement is cleared so state can transition
      expect(localStorage.getItem(`shelf_migration_acknowledged_${userId}`)).toBeNull();
      // Report and backup are intact until new run safely writes fresh results
      expect(localStorage.getItem(reportKey)).not.toBeNull();
      expect(localStorage.getItem(backupKey)).not.toBeNull();
    });
  });

  describe('4. Account Switching & Race Condition Guards', () => {
    it('evaluates different states independently for different user accounts', () => {
      const userA = 'user_alpha';
      const userB = 'user_beta';

      // User A is completed (cutover is marked)
      localStorage.setItem(`shelf_cutover_v1_${userA}`, 'true');

      // User B has unresolved skips requiring attention
      const reportB: MigrationRecordReport = {
        userId: userB,
        timestamp: initialTimestamp,
        collectionsMigrated: 0,
        collectionsSkipped: 1,
        tagsMigrated: 0,
        tagsSkipped: 0,
        bookmarksMigrated: 0,
        bookmarksSkipped: 0,
        warnings: ['User B warning'],
        errors: [],
      };
      localStorage.setItem(`shelf_migration_report_${userB}`, JSON.stringify(reportB));

      const evalA = evaluateMigrationState(userA);
      const evalB = evaluateMigrationState(userB);

      expect(evalA.state).toBe('completed');
      expect(evalA.shouldMigrate).toBe(false);

      expect(evalB.state).toBe('needs_attention');
      expect(evalB.shouldMigrate).toBe(false);
      expect(evalB.report?.collectionsSkipped).toBe(1);
    });

    it('switching to an unacknowledged user account does not inherit previous user acknowledgement', () => {
      const userA = 'user_alpha';
      const userB = 'user_beta';

      // Acknowledge User A
      acknowledgeMigrationReport(userA, initialTimestamp);
      expect(isMigrationAcknowledged(userA, initialTimestamp)).toBe(true);

      // User B has the same timestamp report but is not acknowledged
      expect(isMigrationAcknowledged(userB, initialTimestamp)).toBe(false);
    });
  });
});
