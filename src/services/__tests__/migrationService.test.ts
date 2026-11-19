import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MigrationService, getMigrationReport } from '../migrationService';

describe('MigrationService', () => {
  let mockDb: {
    collections: Map<string, any>;
    tags: Map<string, any>;
    bookmarks: Map<string, any>;
    bookmark_tags: Set<string>; // 'bookmark_id:::tag_id'
  };

  let mockClient: any;
  let service: MigrationService;
  const userId = 'user_mig_test_101';

  const resetMockDb = () => {
    mockDb = {
      collections: new Map(),
      tags: new Map(),
      bookmarks: new Map(),
      bookmark_tags: new Set(),
    };

    mockClient = {
      from: vi.fn((table: string) => {
        const queryState = {
          table,
          filters: [] as { col: string; val: any }[],
          selectedCols: '',
        };

        const builder: any = {
          select: vi.fn((cols: string) => {
            queryState.selectedCols = cols;
            return builder;
          }),
          upsert: vi.fn(async (payload: any) => {
            if (table === 'collections') {
              mockDb.collections.set(payload.id, payload);
            } else if (table === 'tags') {
              mockDb.tags.set(payload.id, payload);
            }
            return { data: payload, error: null };
          }),
          eq: vi.fn((col: string, val: any) => {
            queryState.filters.push({ col, val });
            return builder;
          }),
          then: vi.fn(async (resolve: any) => {
            let data: any[] = [];
            if (table === 'collections') {
              data = Array.from(mockDb.collections.values());
            } else if (table === 'tags') {
              data = Array.from(mockDb.tags.values());
            } else if (table === 'bookmarks') {
              data = Array.from(mockDb.bookmarks.values());
            } else if (table === 'bookmark_tags') {
              data = Array.from(mockDb.bookmark_tags).map((pair) => {
                const [bookmark_id, tag_id] = pair.split(':::');
                return { bookmark_id, tag_id, user_id: userId };
              });
            }

            // Apply filters
            for (const f of queryState.filters) {
              data = data.filter((item) => item[f.col] === f.val);
            }

            return resolve({ data, error: null });
          }),
        };

        return builder;
      }),
      rpc: vi.fn(async (fnName: string, args: any) => {
        if (fnName === 'save_bookmark_with_tags') {
          const { p_bookmark, p_tag_ids } = args;
          mockDb.bookmarks.set(p_bookmark.id, {
            ...p_bookmark,
            collection_id: p_bookmark.collectionId,
            created_at: p_bookmark.createdAt,
            updated_at: p_bookmark.updatedAt,
            user_id: userId,
          });

          // Replace tags
          for (const key of Array.from(mockDb.bookmark_tags)) {
            if (key.startsWith(`${p_bookmark.id}:::`)) {
              mockDb.bookmark_tags.delete(key);
            }
          }
          if (Array.isArray(p_tag_ids)) {
            for (const tagId of p_tag_ids) {
              mockDb.bookmark_tags.add(`${p_bookmark.id}:::${tagId}`);
            }
          }

          return { data: p_bookmark, error: null };
        }
        return { data: null, error: null };
      }),
    };

    service = new MigrationService(mockClient);
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    resetMockDb();
  });

  describe('Empty and Already Migrated States', () => {
    it('returns completed immediately if user has no local data', async () => {
      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('completed');
      expect(result.report.collectionsMigrated).toBe(0);
      expect(result.report.tagsMigrated).toBe(0);
      expect(result.report.bookmarksMigrated).toBe(0);
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBe('true');
    });

    it('skips migration if shelf_migrated_v1 marker is already present', async () => {
      localStorage.setItem(`shelf_migrated_v1_${userId}`, 'true');
      localStorage.setItem(
        `shelf_bookmarks_${userId}`,
        JSON.stringify([{ id: 'bm-1', url: 'https://test.com', title: 'Test' }])
      );

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('completed');
      expect(result.report.warnings).toContain('Migration already completed for this user. Skipped.');
      expect(mockClient.rpc).not.toHaveBeenCalled();
    });

    it('forces migration if options.force is set to true', async () => {
      localStorage.setItem(`shelf_migrated_v1_${userId}`, 'true');
      localStorage.setItem(
        `shelf_bookmarks_${userId}`,
        JSON.stringify([{ id: 'bm-forced', url: 'https://forced.com', title: 'Forced' }])
      );

      const result = await service.migrateUserData(userId, { force: true });

      expect(result.state).toBe('completed');
      expect(result.report.bookmarksMigrated).toBe(1);
      expect(mockDb.bookmarks.has('bm-forced')).toBe(true);
    });
  });

  describe('Full Migration and ID/Relationship Preservation', () => {
    it('migrates collections, tags, and bookmarks preserving original IDs and relationships', async () => {
      const col1 = {
        id: 'col-dev-123',
        name: 'Development',
        description: 'Tech resources',
        color: '#3B82F6',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const tag1 = {
        id: 'tag-react-456',
        name: 'React',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };

      const tag2 = {
        id: 'tag-ts-789',
        name: 'TypeScript',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      };

      const bm1 = {
        id: 'bm-custom-id-999',
        url: 'https://react.dev',
        title: 'React Docs',
        domain: 'react.dev',
        description: 'Official Documentation',
        collectionId: 'col-dev-123',
        tags: ['tag-react-456', 'tag-ts-789'],
        isFavourite: true,
        createdAt: '2026-01-03T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
      };

      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify([col1]));
      localStorage.setItem(`shelf_tags_${userId}`, JSON.stringify([tag1, tag2]));
      localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify([bm1]));

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('completed');
      expect(result.report.collectionsMigrated).toBe(1);
      expect(result.report.tagsMigrated).toBe(2);
      expect(result.report.bookmarksMigrated).toBe(1);

      // Verify original IDs preserved in mock DB
      expect(mockDb.collections.has('col-dev-123')).toBe(true);
      expect(mockDb.tags.has('tag-react-456')).toBe(true);
      expect(mockDb.tags.has('tag-ts-789')).toBe(true);
      expect(mockDb.bookmarks.has('bm-custom-id-999')).toBe(true);

      // Verify relationship preservation
      const savedBm = mockDb.bookmarks.get('bm-custom-id-999');
      expect(savedBm.collection_id).toBe('col-dev-123');
      expect(mockDb.bookmark_tags.has('bm-custom-id-999:::tag-react-456')).toBe(true);
      expect(mockDb.bookmark_tags.has('bm-custom-id-999:::tag-ts-789')).toBe(true);

      // Verify migration marker written
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBe('true');

      // Verify backup key was written
      const backupKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`shelf_backup_v1_${userId}`)) {
          backupKeys.push(k);
        }
      }
      expect(backupKeys.length).toBe(1);

      // Verify original localStorage data was NOT deleted
      expect(localStorage.getItem(`shelf_collections_${userId}`)).not.toBeNull();
      expect(localStorage.getItem(`shelf_tags_${userId}`)).not.toBeNull();
      expect(localStorage.getItem(`shelf_bookmarks_${userId}`)).not.toBeNull();
    });
  });

  describe('Safety Correction 1: Invalid and Skipped Records produce needs_attention', () => {
    it('produces needs_attention when invalid records are skipped and persists report', async () => {
      const collections = [
        { id: '', name: 'No ID' }, // invalid ID
        { id: 'c-valid', name: 'Valid Col' },
        { id: 'c-empty-name', name: '   ' }, // empty name
      ];

      const tags = [
        null, // null entry
        { id: 't-valid', name: 'Valid Tag' },
        { id: 't-no-name' }, // missing name
      ];

      const bookmarks = [
        { id: 'bm-valid', url: 'https://valid.com', title: 'Valid' },
        { id: 'bm-no-url', url: '   ', title: 'Invalid' }, // empty URL
        { id: 'bm-bad-url', url: 'not-a-valid-url', title: 'Bad' }, // invalid URL
      ];

      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify(collections));
      localStorage.setItem(`shelf_tags_${userId}`, JSON.stringify(tags));
      localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify(bookmarks));

      const result = await service.migrateUserData(userId);

      // Invariant 1: State must be 'needs_attention', NOT 'completed'
      expect(result.state).toBe('needs_attention');
      expect(result.report.collectionsMigrated).toBe(1);
      expect(result.report.collectionsSkipped).toBe(2);
      expect(result.report.tagsMigrated).toBe(1);
      expect(result.report.tagsSkipped).toBe(2);
      expect(result.report.bookmarksMigrated).toBe(1);
      expect(result.report.bookmarksSkipped).toBe(2);

      // Invariant 2: shelf_migrated_v1 completion marker MUST NOT be written
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();

      // Invariant 3: Migration report MUST be persisted under shelf_migration_report_${userId}
      const rawReport = localStorage.getItem(`shelf_migration_report_${userId}`);
      expect(rawReport).not.toBeNull();
      const persisted = JSON.parse(rawReport!);
      expect(persisted.collectionsSkipped).toBe(2);
      expect(persisted.tagsSkipped).toBe(2);
      expect(persisted.bookmarksSkipped).toBe(2);
      expect(persisted.warnings.length).toBeGreaterThan(0);

      // Verify helper function
      const helperReport = getMigrationReport(userId);
      expect(helperReport?.collectionsSkipped).toBe(2);

      // Valid records were still migrated
      expect(mockDb.collections.has('c-valid')).toBe(true);
      expect(mockDb.tags.has('t-valid')).toBe(true);
      expect(mockDb.bookmarks.has('bm-valid')).toBe(true);
    });

    it('returns failed and does not write completion marker if report persistence throws', async () => {
      const collections = [{ id: '', name: 'No ID' }]; // Skipped record
      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify(collections));

      const originalSetItem = localStorage.setItem.bind(localStorage);
      vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
        if (key.startsWith('shelf_migration_report_')) {
          throw new Error('QuotaExceededError: Local storage is full');
        }
        return originalSetItem(key, value);
      });

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('failed');
      expect(result.error).toContain('Failed to persist migration report');
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();
      expect(localStorage.getItem(`shelf_collections_${userId}`)).not.toBeNull();
    });

    it('deduplicates local duplicate collection names, remaps bookmarks, and reports needs_attention', async () => {
      const col1 = { id: 'col-primary', name: 'Articles' };
      const col2 = { id: 'col-duplicate', name: 'articles' }; // duplicate case-insensitive name

      const bm = {
        id: 'bm-ref-duplicate',
        url: 'https://article.com',
        title: 'Article',
        collectionId: 'col-duplicate',
      };

      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify([col1, col2]));
      localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify([bm]));

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('needs_attention');
      expect(result.report.collectionsMigrated).toBe(1);
      expect(result.report.collectionsSkipped).toBe(1);

      // Bookmark should point to col-primary
      const savedBm = mockDb.bookmarks.get('bm-ref-duplicate');
      expect(savedBm.collection_id).toBe('col-primary');
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();
    });
  });

  describe('Safety Correction 2: Timestamp Conflict Protection', () => {
    it('preserves existing cloud collection when local updatedAt is missing', async () => {
      mockDb.collections.set('col-preserve', {
        id: 'col-preserve',
        user_id: userId,
        name: 'Cloud Collection (Should Be Preserved)',
        updated_at: '2026-11-01T00:00:00.000Z',
      });

      const localCol = {
        id: 'col-preserve',
        name: 'Local Collection (Missing Timestamp)',
        // No updatedAt!
      };

      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify([localCol]));

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('completed');
      expect(result.report.warnings.some((w) => w.includes('Preserved cloud collection'))).toBe(true);
      expect(mockDb.collections.get('col-preserve').name).toBe(
        'Cloud Collection (Should Be Preserved)'
      );
    });

    it('preserves existing cloud tags and bookmarks when local updatedAt is missing', async () => {
      mockDb.tags.set('tag-preserve', {
        id: 'tag-preserve',
        user_id: userId,
        name: 'Cloud Tag (Preserved)',
        updated_at: '2026-11-01T00:00:00.000Z',
      });

      mockDb.bookmarks.set('bm-preserve', {
        id: 'bm-preserve',
        user_id: userId,
        title: 'Cloud Bookmark Title',
        url: 'https://cloud-preserve.com',
        updated_at: '2026-11-01T00:00:00.000Z',
      });

      const localTag = {
        id: 'tag-preserve',
        name: 'Local Tag (Missing Timestamp)',
      };

      const localBm = {
        id: 'bm-preserve',
        url: 'https://cloud-preserve.com',
        title: 'Local Bookmark Title (Should Not Overwrite)',
      };

      localStorage.setItem(`shelf_tags_${userId}`, JSON.stringify([localTag]));
      localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify([localBm]));

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('completed');
      expect(mockDb.tags.get('tag-preserve').name).toBe('Cloud Tag (Preserved)');
      expect(mockDb.bookmarks.get('bm-preserve').title).toBe('Cloud Bookmark Title');
    });

    it('preserves cloud records when local and cloud timestamps are equal', async () => {
      const sameTimestamp = '2026-11-15T12:00:00.000Z';

      mockDb.collections.set('col-equal', {
        id: 'col-equal',
        user_id: userId,
        name: 'Cloud Collection (Equal Timestamp)',
        updated_at: sameTimestamp,
      });

      mockDb.tags.set('tag-equal', {
        id: 'tag-equal',
        user_id: userId,
        name: 'Cloud Tag (Equal Timestamp)',
        updated_at: sameTimestamp,
      });

      mockDb.bookmarks.set('bm-equal', {
        id: 'bm-equal',
        user_id: userId,
        title: 'Cloud Bookmark (Equal Timestamp)',
        url: 'https://equal.com',
        updated_at: sameTimestamp,
      });

      const localCol = {
        id: 'col-equal',
        name: 'Local Collection (Equal)',
        updatedAt: sameTimestamp,
      };

      const localTag = {
        id: 'tag-equal',
        name: 'Local Tag (Equal)',
        updatedAt: sameTimestamp,
      };

      const localBm = {
        id: 'bm-equal',
        url: 'https://equal.com',
        title: 'Local Bookmark (Equal)',
        updatedAt: sameTimestamp,
      };

      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify([localCol]));
      localStorage.setItem(`shelf_tags_${userId}`, JSON.stringify([localTag]));
      localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify([localBm]));

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('completed');
      expect(mockDb.collections.get('col-equal').name).toBe('Cloud Collection (Equal Timestamp)');
      expect(mockDb.tags.get('tag-equal').name).toBe('Cloud Tag (Equal Timestamp)');
      expect(mockDb.bookmarks.get('bm-equal').title).toBe('Cloud Bookmark (Equal Timestamp)');
    });

    it('updates cloud record when local record has a strictly newer valid timestamp', async () => {
      const cloudOlderTimestamp = '2026-11-01T00:00:00.000Z';
      const localNewerTimestamp = '2026-11-18T18:00:00.000Z';

      mockDb.collections.set('col-newer', {
        id: 'col-newer',
        user_id: userId,
        name: 'Cloud Old Name',
        updated_at: cloudOlderTimestamp,
      });

      mockDb.tags.set('tag-newer', {
        id: 'tag-newer',
        user_id: userId,
        name: 'Cloud Old Tag',
        updated_at: cloudOlderTimestamp,
      });

      mockDb.bookmarks.set('bm-newer', {
        id: 'bm-newer',
        user_id: userId,
        title: 'Cloud Old BM',
        url: 'https://newer.com',
        updated_at: cloudOlderTimestamp,
      });

      const localCol = {
        id: 'col-newer',
        name: 'Local Brand New Collection',
        updatedAt: localNewerTimestamp,
      };

      const localTag = {
        id: 'tag-newer',
        name: 'Local Brand New Tag',
        updatedAt: localNewerTimestamp,
      };

      const localBm = {
        id: 'bm-newer',
        url: 'https://newer.com',
        title: 'Local Brand New Bookmark Title',
        updatedAt: localNewerTimestamp,
      };

      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify([localCol]));
      localStorage.setItem(`shelf_tags_${userId}`, JSON.stringify([localTag]));
      localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify([localBm]));

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('completed');
      expect(mockDb.collections.get('col-newer').name).toBe('Local Brand New Collection');
      expect(mockDb.tags.get('tag-newer').name).toBe('Local Brand New Tag');
      expect(mockDb.bookmarks.get('bm-newer').title).toBe('Local Brand New Bookmark Title');
    });

    it('preserves existing cloud collection when cloud updated_at is missing, flags unresolved conflict, and returns needs_attention', async () => {
      mockDb.collections.set('col-missing-ts', {
        id: 'col-missing-ts',
        user_id: userId,
        name: 'Cloud Collection (No Timestamp)',
        // No updated_at!
      });

      const localCol = {
        id: 'col-missing-ts',
        name: 'Local Collection (Should Not Overwrite)',
        updatedAt: '2026-11-18T12:00:00.000Z',
      };

      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify([localCol]));

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('needs_attention');
      expect(result.report.collectionsSkipped).toBe(1);
      expect(mockDb.collections.get('col-missing-ts').name).toBe('Cloud Collection (No Timestamp)');
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();

      const report = getMigrationReport(userId);
      expect(report).not.toBeNull();
      expect(report?.collectionsSkipped).toBe(1);
      expect(result.report.warnings.some((w) => w.includes('Unresolved timestamp conflict'))).toBe(true);
    });

    it('preserves existing cloud collection when cloud updated_at is invalid, flags unresolved conflict, and returns needs_attention', async () => {
      mockDb.collections.set('col-invalid-ts', {
        id: 'col-invalid-ts',
        user_id: userId,
        name: 'Cloud Collection (Invalid Timestamp)',
        updated_at: 'not-a-valid-iso-date',
      });

      const localCol = {
        id: 'col-invalid-ts',
        name: 'Local Collection (Should Not Overwrite)',
        updatedAt: '2026-11-18T12:00:00.000Z',
      };

      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify([localCol]));

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('needs_attention');
      expect(result.report.collectionsSkipped).toBe(1);
      expect(mockDb.collections.get('col-invalid-ts').name).toBe('Cloud Collection (Invalid Timestamp)');
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();

      const report = getMigrationReport(userId);
      expect(report).not.toBeNull();
      expect(report?.collectionsSkipped).toBe(1);
      expect(result.report.warnings.some((w) => w.includes('Unresolved timestamp conflict'))).toBe(true);
    });

    it('preserves existing cloud tags when cloud updated_at is missing or invalid, flags unresolved conflict, and returns needs_attention', async () => {
      mockDb.tags.set('tag-missing-ts', {
        id: 'tag-missing-ts',
        user_id: userId,
        name: 'Cloud Tag (Missing TS)',
        // No updated_at
      });

      mockDb.tags.set('tag-invalid-ts', {
        id: 'tag-invalid-ts',
        user_id: userId,
        name: 'Cloud Tag (Invalid TS)',
        updated_at: 'garbage-date-string',
      });

      const localTags = [
        { id: 'tag-missing-ts', name: 'Local Overwrite Attempt 1', updatedAt: '2026-11-18T12:00:00.000Z' },
        { id: 'tag-invalid-ts', name: 'Local Overwrite Attempt 2', updatedAt: '2026-11-18T12:00:00.000Z' },
      ];

      localStorage.setItem(`shelf_tags_${userId}`, JSON.stringify(localTags));

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('needs_attention');
      expect(result.report.tagsSkipped).toBe(2);
      expect(mockDb.tags.get('tag-missing-ts').name).toBe('Cloud Tag (Missing TS)');
      expect(mockDb.tags.get('tag-invalid-ts').name).toBe('Cloud Tag (Invalid TS)');
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();

      const report = getMigrationReport(userId);
      expect(report?.tagsSkipped).toBe(2);
      expect(result.report.warnings.filter((w) => w.includes('Unresolved timestamp conflict')).length).toBe(2);
    });

    it('preserves existing cloud bookmarks and their relationships when cloud updated_at is missing or invalid', async () => {
      // Setup existing cloud collection, tags, and bookmark with established relations
      mockDb.collections.set('col-cloud-rel', {
        id: 'col-cloud-rel',
        user_id: userId,
        name: 'Cloud Target Col',
        updated_at: '2026-11-01T00:00:00.000Z',
      });
      mockDb.tags.set('tag-cloud-rel-1', {
        id: 'tag-cloud-rel-1',
        user_id: userId,
        name: 'Cloud Rel Tag 1',
        updated_at: '2026-11-01T00:00:00.000Z',
      });

      mockDb.bookmarks.set('bm-missing-ts', {
        id: 'bm-missing-ts',
        user_id: userId,
        url: 'https://cloud-original.com',
        title: 'Original Cloud Bookmark (Missing TS)',
        collection_id: 'col-cloud-rel',
        // No updated_at!
      });
      mockDb.bookmark_tags.add('bm-missing-ts:::tag-cloud-rel-1');

      mockDb.bookmarks.set('bm-invalid-ts', {
        id: 'bm-invalid-ts',
        user_id: userId,
        url: 'https://cloud-original-2.com',
        title: 'Original Cloud Bookmark (Invalid TS)',
        collection_id: 'col-cloud-rel',
        updated_at: 'invalid-cloud-timestamp-string',
      });
      mockDb.bookmark_tags.add('bm-invalid-ts:::tag-cloud-rel-1');

      // Local attempt to overwrite titles and unassign/reassign relations
      const localBookmarks = [
        {
          id: 'bm-missing-ts',
          url: 'https://cloud-original.com',
          title: 'Local Overwrite Attempt (Should Fail)',
          collectionId: null,
          tags: [],
          updatedAt: '2026-11-18T12:00:00.000Z',
        },
        {
          id: 'bm-invalid-ts',
          url: 'https://cloud-original-2.com',
          title: 'Local Overwrite Attempt 2 (Should Fail)',
          collectionId: null,
          tags: [],
          updatedAt: '2026-11-18T12:00:00.000Z',
        },
      ];

      localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify(localBookmarks));

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('needs_attention');
      expect(result.report.bookmarksSkipped).toBe(2);

      // Verify cloud records were NOT overwritten
      const bm1 = mockDb.bookmarks.get('bm-missing-ts');
      expect(bm1.title).toBe('Original Cloud Bookmark (Missing TS)');
      expect(bm1.collection_id).toBe('col-cloud-rel'); // collection reference intact
      expect(mockDb.bookmark_tags.has('bm-missing-ts:::tag-cloud-rel-1')).toBe(true); // tag relation intact

      const bm2 = mockDb.bookmarks.get('bm-invalid-ts');
      expect(bm2.title).toBe('Original Cloud Bookmark (Invalid TS)');
      expect(bm2.collection_id).toBe('col-cloud-rel'); // collection reference intact
      expect(mockDb.bookmark_tags.has('bm-invalid-ts:::tag-cloud-rel-1')).toBe(true); // tag relation intact

      // Completion marker not written
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();

      // Report persisted
      const report = getMigrationReport(userId);
      expect(report?.bookmarksSkipped).toBe(2);
      expect(result.report.warnings.filter((w) => w.includes('Unresolved timestamp conflict')).length).toBe(2);
    });
  });

  describe('Safety Correction 3: Backup Failure Aborts Migration', () => {
    it('returns failed and aborts migration if creating local backup fails (QuotaExceededError)', async () => {
      const bm = {
        id: 'bm-backup-test',
        url: 'https://backup-test.com',
        title: 'Backup Test',
      };
      localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify([bm]));

      const originalSetItem = localStorage.setItem.bind(localStorage);
      vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
        if (key.startsWith('shelf_backup_v1_')) {
          throw new Error('QuotaExceededError: LocalStorage quota exceeded');
        }
        return originalSetItem(key, value);
      });

      const result = await service.migrateUserData(userId);

      // Invariant: Hard failure
      expect(result.state).toBe('failed');
      expect(result.error).toContain('Failed to create local data backup');

      // Invariant: shelf_migrated_v1 completion marker MUST NOT be written
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();

      // Invariant: original localStorage data MUST remain intact
      expect(localStorage.getItem(`shelf_bookmarks_${userId}`)).not.toBeNull();
    });

    it('aborts on backup failure after cloud writes/verification, and safe retry completes with 0 duplicates and preserved relationships', async () => {
      const col = { id: 'col-backup-retry', name: 'Backup Test Col', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
      const tag = { id: 'tag-backup-retry', name: 'backup-tag', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
      const bm = {
        id: 'bm-backup-retry',
        url: 'https://backup-retry.com',
        title: 'Backup Retry Target',
        collectionId: 'col-backup-retry',
        tags: ['tag-backup-retry'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify([col]));
      localStorage.setItem(`shelf_tags_${userId}`, JSON.stringify([tag]));
      localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify([bm]));

      // 1. First attempt: Mock setItem to throw ONLY when writing backup
      const originalSetItem = localStorage.setItem.bind(localStorage);
      let failBackup = true;
      vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
        if (failBackup && key.startsWith('shelf_backup_v1_')) {
          throw new Error('QuotaExceededError: LocalStorage quota exceeded during backup');
        }
        return originalSetItem(key, value);
      });

      const firstAttempt = await service.migrateUserData(userId);

      // Verify Attempt 1 results
      expect(firstAttempt.state).toBe('failed');
      expect(firstAttempt.error).toContain('Failed to create local data backup');
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();

      // Invariant: Original localStorage remains intact
      expect(localStorage.getItem(`shelf_collections_${userId}`)).not.toBeNull();
      expect(localStorage.getItem(`shelf_tags_${userId}`)).not.toBeNull();
      expect(localStorage.getItem(`shelf_bookmarks_${userId}`)).not.toBeNull();

      // Cloud writes and verification happened before backup failed:
      expect(mockDb.collections.has('col-backup-retry')).toBe(true);
      expect(mockDb.tags.has('tag-backup-retry')).toBe(true);
      expect(mockDb.bookmarks.has('bm-backup-retry')).toBe(true);
      expect(mockDb.bookmark_tags.has('bm-backup-retry:::tag-backup-retry')).toBe(true);

      // 2. Second attempt: Storage issue resolved, backup succeeds
      failBackup = false;

      const secondAttempt = await service.migrateUserData(userId);

      // Verify Attempt 2 results
      expect(secondAttempt.state).toBe('completed');
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBe('true');

      // Verify zero duplicate records in mockDb
      expect(mockDb.collections.size).toBe(1);
      expect(mockDb.tags.size).toBe(1);
      expect(mockDb.bookmarks.size).toBe(1);
      expect(mockDb.bookmark_tags.size).toBe(1);

      // Verify relationships remain intact
      const savedBm = mockDb.bookmarks.get('bm-backup-retry');
      expect(savedBm.collection_id).toBe('col-backup-retry');
      expect(mockDb.bookmark_tags.has('bm-backup-retry:::tag-backup-retry')).toBe(true);
    });
  });

  describe('Retry and Recovery after Partial Failure', () => {
    it('successfully completes retry after partial failure without duplicating records', async () => {
      const col = { id: 'col-retry', name: 'Work', createdAt: '2026-01-01T00:00:00.000Z' };
      const tag = { id: 'tag-retry', name: 'urgent', createdAt: '2026-01-01T00:00:00.000Z' };
      const bm = {
        id: 'bm-retry',
        url: 'https://retry.com',
        title: 'Retry Target',
        collectionId: 'col-retry',
        tags: ['tag-retry'],
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify([col]));
      localStorage.setItem(`shelf_tags_${userId}`, JSON.stringify([tag]));
      localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify([bm]));

      // 1. First run fails during bookmark RPC
      mockClient.rpc = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Failed to fetch', code: '' },
      });

      const firstAttempt = await service.migrateUserData(userId);
      expect(firstAttempt.state).toBe('failed');
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();

      // Collections and tags were inserted into cloud in stage 1 & 2
      expect(mockDb.collections.has('col-retry')).toBe(true);
      expect(mockDb.tags.has('tag-retry')).toBe(true);

      // 2. Second run: RPC succeeds
      resetMockDb();
      // Re-populate cloud DB with items upserted in attempt 1 (with their valid timestamps)
      mockDb.collections.set('col-retry', {
        id: 'col-retry',
        user_id: userId,
        name: 'Work',
        updated_at: '2026-01-01T00:00:00.000Z',
      });
      mockDb.tags.set('tag-retry', {
        id: 'tag-retry',
        user_id: userId,
        name: 'urgent',
        updated_at: '2026-01-01T00:00:00.000Z',
      });

      const secondAttempt = await service.migrateUserData(userId);
      expect(secondAttempt.state).toBe('completed');
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBe('true');

      // Verify no duplicates
      expect(mockDb.collections.size).toBe(1);
      expect(mockDb.tags.size).toBe(1);
      expect(mockDb.bookmarks.size).toBe(1);

      const saved = mockDb.bookmarks.get('bm-retry');
      expect(saved.collection_id).toBe('col-retry');
      expect(mockDb.bookmark_tags.has('bm-retry:::tag-retry')).toBe(true);
    });

    it('unassigns invalid collection reference and filters out non-existent tag IDs', async () => {
      const bm = {
        id: 'bm-orphan',
        url: 'https://orphan.com',
        title: 'Orphan Links',
        collectionId: 'non-existent-col',
        tags: ['non-existent-tag'],
      };

      localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify([bm]));

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('completed');
      expect(result.report.bookmarksMigrated).toBe(1);

      const saved = mockDb.bookmarks.get('bm-orphan');
      expect(saved.collection_id).toBeNull();
      expect(mockDb.bookmark_tags.size).toBe(0);
      expect(result.report.warnings).toContain(
        'Bookmark [bm-orphan] referenced non-existent collection [non-existent-col]. Unassigned collection reference.'
      );
      expect(result.report.warnings).toContain(
        'Bookmark [bm-orphan] referenced non-existent tag [non-existent-tag]. Removed tag association.'
      );
    });

    it('handles verification failure: does not set migrated marker and leaves localStorage intact', async () => {
      const bm = {
        id: 'bm-verify-fail',
        url: 'https://fail.com',
        title: 'Fail',
      };

      localStorage.setItem(`shelf_bookmarks_${userId}`, JSON.stringify([bm]));

      // Override verification query to omit the bookmark
      const originalFrom = mockClient.from;
      mockClient.from = vi.fn((table: string) => {
        if (table === 'bookmarks') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            then: vi.fn((resolve: any) => resolve({ data: [], error: null })),
          };
        }
        return originalFrom(table);
      });

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('failed');
      expect(result.error).toContain('Verification failed: Bookmark [bm-verify-fail]');
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();
      expect(localStorage.getItem(`shelf_bookmarks_${userId}`)).not.toBeNull();
    });

    it('handles session expiration during migration gracefully', async () => {
      localStorage.setItem(
        `shelf_collections_${userId}`,
        JSON.stringify([{ id: 'col-1', name: 'Work' }])
      );

      mockClient.from = vi.fn((table: string) => {
        if (table === 'collections') {
          return {
            select: vi.fn().mockReturnThis(),
            upsert: vi.fn(async () => {
              return { data: null, error: { status: 401, message: 'JWT expired', code: 'PGRST301' } };
            }),
            eq: vi.fn().mockReturnThis(),
            then: vi.fn((resolve: any) => resolve({ data: [], error: null })),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: any) => resolve({ data: [], error: null })),
        };
      });

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('failed');
      expect(result.error).toBe('Your session has expired. Please sign in again.');
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();
      expect(localStorage.getItem(`shelf_collections_${userId}`)).not.toBeNull();
    });

    it('handles malformed JSON in localStorage gracefully without crashing', async () => {
      localStorage.setItem(`shelf_collections_${userId}`, 'this-is-not-json{{{');
      localStorage.setItem(
        `shelf_bookmarks_${userId}`,
        JSON.stringify([{ id: 'bm-valid', url: 'https://valid.com', title: 'Valid' }])
      );

      const result = await service.migrateUserData(userId);

      expect(result.state).toBe('completed');
      expect(result.report.bookmarksMigrated).toBe(1);
      expect(result.report.warnings.some((w) => w.includes('malformed JSON'))).toBe(true);
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBe('true');
    });

    it('prevents simultaneous migration runs for the same user', async () => {
      localStorage.setItem(
        `shelf_bookmarks_${userId}`,
        JSON.stringify([{ id: 'bm-1', url: 'https://test.com', title: 'Test' }])
      );

      let resolveFirst: any;
      mockClient.rpc = vi.fn(() => new Promise((res) => { resolveFirst = res; }));

      const firstPromise = service.migrateUserData(userId);

      await expect(service.migrateUserData(userId)).rejects.toThrow(
        `Migration is already in progress for user ${userId}.`
      );

      resolveFirst({ data: {}, error: null });
      await firstPromise;
    });

    it('resetMigrationMarker removes the marker and report allowing re-migration', async () => {
      localStorage.setItem(`shelf_migrated_v1_${userId}`, 'true');
      localStorage.setItem(`shelf_migration_report_${userId}`, '{"skipped":0}');
      expect(service.isUserMigrated(userId)).toBe(true);

      service.resetMigrationMarker(userId);
      expect(service.isUserMigrated(userId)).toBe(false);
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();
      expect(localStorage.getItem(`shelf_migration_report_${userId}`)).toBeNull();
    });

    it('completion marker failure preserves existing migration report and acknowledgement without reporting completion', async () => {
      // Setup: user has a prior attention report and acknowledgement
      const existingReport = {
        userId,
        timestamp: '2026-11-18T12:00:00.000Z',
        collectionsMigrated: 1,
        collectionsSkipped: 1,
        tagsMigrated: 0,
        tagsSkipped: 0,
        bookmarksMigrated: 0,
        bookmarksSkipped: 0,
        warnings: ['Previous skipped item'],
        errors: [],
      };
      localStorage.setItem(`shelf_migration_report_${userId}`, JSON.stringify(existingReport));
      localStorage.setItem(`shelf_migration_acknowledged_${userId}`, '2026-11-18T12:00:00.000Z');
      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify([{ id: 'c-clean', name: 'Clean Collection' }]));

      // Mock localStorage.setItem to throw only when writing the completion marker
      const originalSetItem = localStorage.setItem.bind(localStorage);
      vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
        if (key === `shelf_migrated_v1_${userId}`) {
          throw new Error('QuotaExceededError: Disk is full');
        }
        return originalSetItem(key, value);
      });

      const result = await service.migrateUserData(userId, { force: true });

      // Invariant: Must return failed
      expect(result.state).toBe('failed');
      expect(result.error).toContain('Failed to persist migration completion marker');
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBeNull();

      // Invariant: Pre-existing report and acknowledgement are NOT deleted
      expect(localStorage.getItem(`shelf_migration_report_${userId}`)).not.toBeNull();
      expect(localStorage.getItem(`shelf_migration_acknowledged_${userId}`)).toBe('2026-11-18T12:00:00.000Z');
    });

    it('cleans up report and acknowledgement only after completion marker is successfully persisted', async () => {
      const orderOfOperations: string[] = [];

      localStorage.setItem(`shelf_migration_report_${userId}`, '{"skipped":1}');
      localStorage.setItem(`shelf_migration_acknowledged_${userId}`, '2026-11-18T12:00:00.000Z');
      localStorage.setItem(`shelf_collections_${userId}`, JSON.stringify([{ id: 'c-clean', name: 'Clean Collection' }]));

      const originalSetItem = localStorage.setItem.bind(localStorage);
      const originalRemoveItem = localStorage.removeItem.bind(localStorage);

      vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, value: string) => {
        if (key === `shelf_migrated_v1_${userId}`) {
          orderOfOperations.push('SET_COMPLETION_MARKER');
        }
        return originalSetItem(key, value);
      });

      vi.spyOn(localStorage, 'removeItem').mockImplementation((key: string) => {
        if (key === `shelf_migration_report_${userId}`) {
          orderOfOperations.push('REMOVE_REPORT');
        }
        if (key === `shelf_migration_acknowledged_${userId}`) {
          orderOfOperations.push('CLEAR_ACKNOWLEDGEMENT');
        }
        return originalRemoveItem(key);
      });

      const result = await service.migrateUserData(userId, { force: true });

      expect(result.state).toBe('completed');
      expect(orderOfOperations).toEqual(['SET_COMPLETION_MARKER', 'REMOVE_REPORT', 'CLEAR_ACKNOWLEDGEMENT']);
      expect(localStorage.getItem(`shelf_migrated_v1_${userId}`)).toBe('true');
      expect(localStorage.getItem(`shelf_migration_report_${userId}`)).toBeNull();
      expect(localStorage.getItem(`shelf_migration_acknowledged_${userId}`)).toBeNull();
    });
  });
});
