import type { SupabaseClient } from '@supabase/supabase-js';
import type { Bookmark, Collection, Tag } from '../types';
import { getSupabaseClient } from '../lib/supabase';
import { translateSupabaseError } from './supabaseError';
import { normalizeUrl, isValidUrl, generateFallbackTitle } from '../lib/metadata';
import { extractDomain } from '../lib/utils';

export type MigrationState =
  | 'idle'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'needs_attention';

export interface MigrationRecordReport {
  userId?: string;
  timestamp?: string;
  collectionsMigrated: number;
  collectionsSkipped: number;
  tagsMigrated: number;
  tagsSkipped: number;
  bookmarksMigrated: number;
  bookmarksSkipped: number;
  warnings: string[];
  errors: string[];
}

export interface MigrationResult {
  state: MigrationState;
  userId: string;
  report: MigrationRecordReport;
  error?: string;
  migratedAt?: string;
}

export interface MigrationOptions {
  client?: SupabaseClient;
  force?: boolean;
  onProgress?: (stage: string) => void;
}

// In-memory set to prevent concurrent migrations for the same user within the app
const inFlightMigrations = new Set<string>();

/**
 * Migration Service: Safely transfers authenticated user's localStorage
 * collections, tags, and bookmarks to Supabase with strict ID preservation,
 * relational verification, and multi-layered data protection.
 */
export class MigrationService {
  private client: SupabaseClient | null;

  constructor(client?: SupabaseClient) {
    this.client = client || null;
  }

  private getClient(overrideClient?: SupabaseClient): SupabaseClient {
    if (overrideClient) return overrideClient;
    if (this.client) return this.client;
    return getSupabaseClient();
  }

  /**
   * Checks whether the user has successfully completed migration to Supabase.
   */
  isUserMigrated(userId: string): boolean {
    if (!userId || !userId.trim()) return false;
    return localStorage.getItem(`shelf_migrated_v1_${userId.trim()}`) === 'true';
  }

  /**
   * Checks whether the user has successfully completed final cutover reconciliation to Supabase.
   */
  isUserCutover(userId: string): boolean {
    if (!userId || !userId.trim()) return false;
    return localStorage.getItem(`shelf_cutover_v1_${userId.trim()}`) === 'true';
  }

  /**
   * Persists the authoritative cutover marker after successful reconciliation.
   * Verifies that the marker was persisted successfully before returning success.
   */
  markUserCutover(userId: string): { success: boolean; error?: string } {
    if (!userId || !userId.trim()) {
      return { success: false, error: 'User ID is required to mark cutover complete.' };
    }
    const trimmedUserId = userId.trim();
    const key = `shelf_cutover_v1_${trimmedUserId}`;
    try {
      localStorage.setItem(key, 'true');
      const verified = localStorage.getItem(key) === 'true';
      if (!verified) {
        return { success: false, error: 'Failed to verify cutover marker persistence.' };
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `Failed to persist cutover marker: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Resets the cutover marker for testing or manual re-runs.
   */
  resetCutoverMarker(userId: string): void {
    if (!userId || !userId.trim()) return;
    localStorage.removeItem(`shelf_cutover_v1_${userId.trim()}`);
  }

  /**
   * Resets the migration marker for testing or manual re-runs.
   */
  resetMigrationMarker(userId: string): void {
    if (!userId || !userId.trim()) return;
    localStorage.removeItem(`shelf_migrated_v1_${userId.trim()}`);
    localStorage.removeItem(`shelf_migration_report_${userId.trim()}`);
    localStorage.removeItem(`shelf_cutover_v1_${userId.trim()}`);
    this.clearMigrationAcknowledgement(userId);
  }

  /**
   * Persists user acknowledgement of a specific migration report (e.g. when skipped records occurred).
   * Guarantees:
   * - Never writes shelf_migrated_v1 completion marker.
   * - Never deletes the migration report or pre-migration local records.
   * - Stores the exact report timestamp.
   * - Safely catches storage quota/permission errors and returns { success: false, error }.
   */
  acknowledgeMigrationReport(userId: string, timestamp: string): { success: boolean; error?: string } {
    if (!userId || !userId.trim()) {
      return { success: false, error: 'User ID is required to acknowledge migration report.' };
    }
    if (!timestamp || !timestamp.trim()) {
      return { success: false, error: 'Report timestamp is required to acknowledge migration report.' };
    }

    const trimmedUserId = userId.trim();
    const ackKey = `shelf_migration_acknowledged_${trimmedUserId}`;

    try {
      localStorage.setItem(ackKey, timestamp.trim());
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `Failed to persist migration acknowledgement (${err instanceof Error ? err.message : String(err)}).`,
      };
    }
  }

  /**
   * Checks whether the user has acknowledged an incomplete migration report.
   * If a specific timestamp is provided, verifies that the stored acknowledgement matches that exact timestamp.
   * If no timestamp is provided, checks if an acknowledged timestamp exists matching the current stored report.
   */
  isMigrationAcknowledged(userId: string, timestamp?: string): boolean {
    if (!userId || !userId.trim()) return false;
    const trimmedUserId = userId.trim();
    const ackKey = `shelf_migration_acknowledged_${trimmedUserId}`;
    try {
      const storedAck = localStorage.getItem(ackKey);
      if (!storedAck) return false;

      if (timestamp && timestamp.trim()) {
        return storedAck === timestamp.trim();
      }

      // If timestamp omitted, verify against currently persisted report
      const currentReport = this.getMigrationReport(trimmedUserId);
      if (!currentReport || !currentReport.timestamp) return false;
      return storedAck === currentReport.timestamp;
    } catch {
      return false;
    }
  }

  /**
   * Clears the acknowledgement marker (e.g. when initiating a deliberate retry).
   */
  clearMigrationAcknowledgement(userId: string): void {
    if (!userId || !userId.trim()) return;
    try {
      localStorage.removeItem(`shelf_migration_acknowledged_${userId.trim()}`);
    } catch {
      // Ignore storage errors on removal
    }
  }

  /**
   * Retrieves the persisted migration report for a user, if one exists.
   */
  getMigrationReport(userId: string): MigrationRecordReport | null {
    if (!userId || !userId.trim()) return null;
    try {
      const raw = localStorage.getItem(`shelf_migration_report_${userId.trim()}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Safely reads raw localStorage data for a user without modifying it.
   */
  private readLocalData(userId: string): {
    collections: any[];
    tags: any[];
    bookmarks: any[];
    warnings: string[];
  } {
    const warnings: string[] = [];

    const readKey = (key: string): any[] => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        warnings.push(`Local storage key "${key}" contains non-array data. Ignored.`);
        return [];
      } catch (err) {
        warnings.push(`Local storage key "${key}" contains malformed JSON: ${String(err)}`);
        return [];
      }
    };

    const collections = readKey(`shelf_collections_${userId}`);
    const tags = readKey(`shelf_tags_${userId}`);
    const bookmarks = readKey(`shelf_bookmarks_${userId}`);

    return { collections, tags, bookmarks, warnings };
  }

  /**
   * Validates a timestamp string, falling back to a safe ISO string.
   */
  private sanitizeTimestamp(ts: any, fallback: string): string {
    if (typeof ts === 'string' && ts.trim()) {
      const parsed = Date.parse(ts);
      if (!isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }
    }
    return fallback;
  }

  /**
   * Checks whether a raw timestamp is valid and non-empty.
   */
  private isValidTimestamp(ts: any): boolean {
    if (typeof ts !== 'string' || !ts.trim()) return false;
    const parsed = Date.parse(ts.trim());
    return !isNaN(parsed);
  }

  /**
   * Determines whether an existing cloud record should be preserved rather than overwritten by a local record.
   * Invariants (Strict Timestamp Conflict Matrix):
   * 1. No cloud record exists -> return { preserve: false, isUnresolvedConflict: false } (migrate normally).
   * 2. Cloud record exists with missing or invalid updated_at -> return { preserve: true, isUnresolvedConflict: true }
   *    (ambiguous timestamp: preserve cloud record, never overwrite automatically, flag as unresolved conflict requiring attention).
   * 3. Cloud record exists with valid updated_at:
   *    - Local timestamp is missing or invalid -> return { preserve: true, isUnresolvedConflict: false } (preserve cloud record).
   *    - Cloud timestamp >= local timestamp -> return { preserve: true, isUnresolvedConflict: false } (preserve cloud record).
   *    - Local timestamp strictly newer (> cloud timestamp) -> return { preserve: false, isUnresolvedConflict: false } (local may update cloud).
   */
  private shouldPreserveCloudRecord(
    existingCloudRecord: { updated_at?: string } | undefined,
    rawLocalUpdatedAt: any
  ): { preserve: boolean; isUnresolvedConflict: boolean; reason: string } {
    if (!existingCloudRecord) {
      return { preserve: false, isUnresolvedConflict: false, reason: 'No existing cloud record.' };
    }

    // Cloud record exists with missing or invalid timestamp -> Ambiguous/unresolved conflict:
    // Existing cloud record with a missing or invalid timestamp must never be overwritten automatically.
    if (!this.isValidTimestamp(existingCloudRecord.updated_at)) {
      return {
        preserve: true,
        isUnresolvedConflict: true,
        reason: 'Cloud record exists with missing or invalid updated_at timestamp. Preserved cloud record without overwriting.',
      };
    }

    const cloudUpdatedAt = existingCloudRecord.updated_at!;
    const cloudTime = Date.parse(cloudUpdatedAt.trim());

    // Cloud timestamp is valid, but local timestamp is missing or invalid -> Preserve cloud safely
    if (!this.isValidTimestamp(rawLocalUpdatedAt)) {
      return {
        preserve: true,
        isUnresolvedConflict: false,
        reason: 'Cloud record has a valid timestamp while local timestamp was missing or invalid.',
      };
    }

    const localTime = Date.parse(String(rawLocalUpdatedAt).trim());

    // Cloud timestamp is equal or newer -> Preserve cloud
    if (cloudTime >= localTime) {
      return {
        preserve: true,
        isUnresolvedConflict: false,
        reason: `Cloud record is newer or equal (cloud: ${cloudUpdatedAt} >= local: ${rawLocalUpdatedAt}).`,
      };
    }

    // Local timestamp is strictly newer -> Local may update cloud
    return {
      preserve: false,
      isUnresolvedConflict: false,
      reason: `Local record is strictly newer (local: ${rawLocalUpdatedAt} > cloud: ${cloudUpdatedAt}).`,
    };
  }

  /**
   * Executes the one-time migration for the given user.
   */
  async migrateUserData(
    userId: string,
    options?: MigrationOptions
  ): Promise<MigrationResult> {
    if (!userId || !userId.trim()) {
      throw new Error('Authentication required: Cannot migrate data without a valid user ID.');
    }

    const trimmedUserId = userId.trim();
    const client = this.getClient(options?.client);

    // Prevent concurrent runs for the same user
    if (inFlightMigrations.has(trimmedUserId)) {
      throw new Error(`Migration is already in progress for user ${trimmedUserId}.`);
    }

    // Skip if already migrated (unless force is requested)
    if (this.isUserMigrated(trimmedUserId) && !options?.force) {
      return {
        state: 'completed',
        userId: trimmedUserId,
        report: {
          collectionsMigrated: 0,
          collectionsSkipped: 0,
          tagsMigrated: 0,
          tagsSkipped: 0,
          bookmarksMigrated: 0,
          bookmarksSkipped: 0,
          warnings: ['Migration already completed for this user. Skipped.'],
          errors: [],
        },
        migratedAt: new Date().toISOString(),
      };
    }

    inFlightMigrations.add(trimmedUserId);

    const report: MigrationRecordReport = {
      collectionsMigrated: 0,
      collectionsSkipped: 0,
      tagsMigrated: 0,
      tagsSkipped: 0,
      bookmarksMigrated: 0,
      bookmarksSkipped: 0,
      warnings: [],
      errors: [],
    };

    try {
      options?.onProgress?.('Reading local data');

      const { collections: rawCollections, tags: rawTags, bookmarks: rawBookmarks, warnings: readWarnings } =
        this.readLocalData(trimmedUserId);
      report.warnings.push(...readWarnings);

      const hasLocalData =
        rawCollections.length > 0 || rawTags.length > 0 || rawBookmarks.length > 0;

      // If user has zero local data, mark as migrated and return immediately
      if (!hasLocalData) {
        try {
          localStorage.setItem(`shelf_migrated_v1_${trimmedUserId}`, 'true');
        } catch (err) {
          const markerError = `Failed to persist migration completion marker: ${err instanceof Error ? err.message : String(err)}`;
          report.errors.push(markerError);
          return {
            state: 'failed',
            userId: trimmedUserId,
            report,
            error: markerError,
          };
        }

        try {
          localStorage.removeItem(`shelf_migration_report_${trimmedUserId}`);
        } catch {
          // Non-fatal cleanup
        }

        try {
          this.clearMigrationAcknowledgement(trimmedUserId);
        } catch {
          // Non-fatal cleanup
        }

        return {
          state: 'completed',
          userId: trimmedUserId,
          report,
          migratedAt: new Date().toISOString(),
        };
      }

      options?.onProgress?.('Querying existing cloud state');

      // Fetch existing cloud data for conflict detection and newer timestamp preservation
      const [cloudColRes, cloudTagRes, cloudBmRes, cloudBtRes] = await Promise.all([
        client.from('collections').select('id, name, updated_at').eq('user_id', trimmedUserId),
        client.from('tags').select('id, name, updated_at').eq('user_id', trimmedUserId),
        client.from('bookmarks').select('id, url, collection_id, updated_at').eq('user_id', trimmedUserId),
        client.from('bookmark_tags').select('bookmark_id, tag_id').eq('user_id', trimmedUserId),
      ]);

      if (cloudColRes.error) throw translateSupabaseError(cloudColRes.error, { entityType: 'collection' });
      if (cloudTagRes.error) throw translateSupabaseError(cloudTagRes.error, { entityType: 'tag' });
      if (cloudBmRes.error) throw translateSupabaseError(cloudBmRes.error, { entityType: 'bookmark' });
      if (cloudBtRes.error) throw translateSupabaseError(cloudBtRes.error);

      const cloudCollections = cloudColRes.data || [];
      const cloudTags = cloudTagRes.data || [];
      const cloudBookmarks = cloudBmRes.data || [];

      // Cloud lookup maps
      const cloudColById = new Map<string, any>(cloudCollections.map((c) => [c.id, c]));
      const cloudColByName = new Map<string, any>(cloudCollections.map((c) => [c.name.trim().toLowerCase(), c]));

      const cloudTagById = new Map<string, any>(cloudTags.map((t) => [t.id, t]));
      const cloudTagByName = new Map<string, any>(cloudTags.map((t) => [t.name.trim().toLowerCase(), t]));

      const cloudBmById = new Map<string, any>(cloudBookmarks.map((b) => [b.id, b]));

      // ID translation maps for reconciling name collisions across devices
      const collectionIdAliasMap = new Map<string, string>();
      const tagIdAliasMap = new Map<string, string>();

      const now = new Date().toISOString();

      // ========================================================================
      // 1. RECONCILE & MIGRATE COLLECTIONS
      // ========================================================================
      options?.onProgress?.('Migrating collections');

      const validCollections: Collection[] = [];
      const seenLocalColNames = new Map<string, string>(); // lowerName -> id

      for (const raw of rawCollections) {
        if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.trim()) {
          report.collectionsSkipped++;
          report.warnings.push(`Skipped collection with missing or invalid ID.`);
          continue;
        }

        const id = raw.id.trim();
        const rawName = typeof raw.name === 'string' ? raw.name.trim() : '';
        if (!rawName) {
          report.collectionsSkipped++;
          report.warnings.push(`Skipped collection [${id}] because name is empty.`);
          continue;
        }

        const lowerName = rawName.toLowerCase();
        // Check for local duplicate names
        if (seenLocalColNames.has(lowerName)) {
          const primaryId = seenLocalColNames.get(lowerName)!;
          collectionIdAliasMap.set(id, primaryId);
          report.collectionsSkipped++;
          report.warnings.push(
            `Collection "${rawName}" [${id}] duplicates local collection [${primaryId}]. References remapped.`
          );
          continue;
        }
        seenLocalColNames.set(lowerName, id);

        const createdAt = this.sanitizeTimestamp(raw.createdAt, now);
        const updatedAt = this.sanitizeTimestamp(raw.updatedAt, createdAt);

        // Check if matching cloud collection exists by name under a different ID
        const cloudByName = cloudColByName.get(lowerName);
        if (cloudByName && cloudByName.id !== id) {
          collectionIdAliasMap.set(id, cloudByName.id);
          report.warnings.push(
            `Collection "${rawName}" [${id}] exists in cloud as [${cloudByName.id}]. References remapped to cloud collection.`
          );
          continue;
        }

        // Check if cloud record exists by ID and should be preserved
        const existingCloud = cloudColById.get(id);
        const conflictDecision = this.shouldPreserveCloudRecord(existingCloud, raw.updatedAt);
        if (conflictDecision.preserve) {
          if (conflictDecision.isUnresolvedConflict) {
            report.collectionsSkipped++;
            report.warnings.push(
              `Unresolved timestamp conflict: Cloud collection "${existingCloud?.name || rawName}" [${id}] has a missing or invalid updated_at timestamp. Preserved cloud collection without overwriting.`
            );
          } else {
            report.warnings.push(
              `Preserved cloud collection "${existingCloud?.name || rawName}" [${id}] (${conflictDecision.reason}).`
            );
          }
          continue;
        }

        validCollections.push({
          id,
          name: rawName,
          description: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : undefined,
          color: typeof raw.color === 'string' && raw.color.trim() ? raw.color.trim() : undefined,
          createdAt,
          updatedAt,
        });
      }

      // Upsert valid collections into cloud
      for (const col of validCollections) {
        const { error } = await client.from('collections').upsert({
          id: col.id,
          user_id: trimmedUserId,
          name: col.name,
          description: col.description || null,
          color: col.color || null,
          created_at: col.createdAt,
          updated_at: col.updatedAt,
        });

        if (error) {
          throw translateSupabaseError(error, { entityType: 'collection', name: col.name });
        }
        report.collectionsMigrated++;
      }

      // ========================================================================
      // 2. RECONCILE & MIGRATE TAGS
      // ========================================================================
      options?.onProgress?.('Migrating tags');

      const validTags: Tag[] = [];
      const seenLocalTagNames = new Map<string, string>(); // lowerName -> id

      for (const raw of rawTags) {
        if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.trim()) {
          report.tagsSkipped++;
          report.warnings.push(`Skipped tag with missing or invalid ID.`);
          continue;
        }

        const id = raw.id.trim();
        const rawName = typeof raw.name === 'string' ? raw.name.trim() : '';
        if (!rawName) {
          report.tagsSkipped++;
          report.warnings.push(`Skipped tag [${id}] because name is empty.`);
          continue;
        }

        const lowerName = rawName.toLowerCase();
        if (seenLocalTagNames.has(lowerName)) {
          const primaryId = seenLocalTagNames.get(lowerName)!;
          tagIdAliasMap.set(id, primaryId);
          report.tagsSkipped++;
          report.warnings.push(
            `Tag "${rawName}" [${id}] duplicates local tag [${primaryId}]. References remapped.`
          );
          continue;
        }
        seenLocalTagNames.set(lowerName, id);

        const createdAt = this.sanitizeTimestamp(raw.createdAt, now);
        const updatedAt = this.sanitizeTimestamp(raw.updatedAt, createdAt);

        // Check if matching cloud tag exists by name under a different ID
        const cloudByName = cloudTagByName.get(lowerName);
        if (cloudByName && cloudByName.id !== id) {
          tagIdAliasMap.set(id, cloudByName.id);
          report.warnings.push(
            `Tag "${rawName}" [${id}] exists in cloud as [${cloudByName.id}]. References remapped to cloud tag.`
          );
          continue;
        }

        // Check if cloud record exists by ID and should be preserved
        const existingCloud = cloudTagById.get(id);
        const conflictDecision = this.shouldPreserveCloudRecord(existingCloud, raw.updatedAt);
        if (conflictDecision.preserve) {
          if (conflictDecision.isUnresolvedConflict) {
            report.tagsSkipped++;
            report.warnings.push(
              `Unresolved timestamp conflict: Cloud tag "${existingCloud?.name || rawName}" [${id}] has a missing or invalid updated_at timestamp. Preserved cloud tag without overwriting.`
            );
          } else {
            report.warnings.push(
              `Preserved cloud tag "${existingCloud?.name || rawName}" [${id}] (${conflictDecision.reason}).`
            );
          }
          continue;
        }

        validTags.push({
          id,
          name: rawName,
          createdAt,
          updatedAt,
        });
      }

      // Upsert valid tags into cloud
      for (const tag of validTags) {
        const { error } = await client.from('tags').upsert({
          id: tag.id,
          user_id: trimmedUserId,
          name: tag.name,
          created_at: tag.createdAt,
          updated_at: tag.updatedAt,
        });

        if (error) {
          throw translateSupabaseError(error, { entityType: 'tag', name: tag.name });
        }
        report.tagsMigrated++;
      }

      // ========================================================================
      // 3. RECONCILE & MIGRATE BOOKMARKS & RELATIONS
      // ========================================================================
      options?.onProgress?.('Migrating bookmarks and relations');

      // Compile set of all valid collection IDs (cloud + newly migrated)
      const allValidCollectionIds = new Set<string>([
        ...cloudCollections.map((c) => c.id),
        ...validCollections.map((c) => c.id),
      ]);

      // Compile set of all valid tag IDs (cloud + newly migrated)
      const allValidTagIds = new Set<string>([
        ...cloudTags.map((t) => t.id),
        ...validTags.map((t) => t.id),
      ]);

      const validBookmarks: Bookmark[] = [];

      for (const raw of rawBookmarks) {
        if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.trim()) {
          report.bookmarksSkipped++;
          report.warnings.push(`Skipped bookmark with missing or invalid ID.`);
          continue;
        }

        const id = raw.id.trim();
        const rawUrl = typeof raw.url === 'string' ? raw.url.trim() : '';
        if (!rawUrl) {
          report.bookmarksSkipped++;
          report.warnings.push(`Skipped bookmark [${id}] because URL is empty.`);
          continue;
        }

        const normalizedUrl = normalizeUrl(rawUrl);
        if (!normalizedUrl || !isValidUrl(normalizedUrl)) {
          report.bookmarksSkipped++;
          report.warnings.push(`Skipped bookmark [${id}] with invalid URL: "${rawUrl}".`);
          continue;
        }

        const createdAt = this.sanitizeTimestamp(raw.createdAt, now);
        const updatedAt = this.sanitizeTimestamp(raw.updatedAt, createdAt);

        // Check if cloud record exists by ID and should be preserved
        const existingCloud = cloudBmById.get(id);
        const conflictDecision = this.shouldPreserveCloudRecord(existingCloud, raw.updatedAt);
        if (conflictDecision.preserve) {
          if (conflictDecision.isUnresolvedConflict) {
            report.bookmarksSkipped++;
            report.warnings.push(
              `Unresolved timestamp conflict: Cloud bookmark [${id}] (${existingCloud?.url || normalizedUrl}) has a missing or invalid updated_at timestamp. Preserved cloud bookmark without overwriting.`
            );
          } else {
            report.warnings.push(
              `Preserved cloud bookmark [${id}] (${existingCloud?.url || normalizedUrl}) (${conflictDecision.reason}).`
            );
          }
          continue;
        }

        // Resolve collection relationship
        let effectiveCollectionId: string | undefined;
        if (typeof raw.collectionId === 'string' && raw.collectionId.trim()) {
          let colId = raw.collectionId.trim();
          if (collectionIdAliasMap.has(colId)) {
            colId = collectionIdAliasMap.get(colId)!;
          }

          if (allValidCollectionIds.has(colId)) {
            effectiveCollectionId = colId;
          } else {
            report.warnings.push(
              `Bookmark [${id}] referenced non-existent collection [${colId}]. Unassigned collection reference.`
            );
          }
        }

        // Resolve tag relationships
        const effectiveTags: string[] = [];
        if (Array.isArray(raw.tags)) {
          for (const rawTagId of raw.tags) {
            if (typeof rawTagId !== 'string' || !rawTagId.trim()) continue;
            let tagId = rawTagId.trim();
            if (tagIdAliasMap.has(tagId)) {
              tagId = tagIdAliasMap.get(tagId)!;
            }

            if (allValidTagIds.has(tagId)) {
              if (!effectiveTags.includes(tagId)) {
                effectiveTags.push(tagId);
              }
            } else {
              report.warnings.push(
                `Bookmark [${id}] referenced non-existent tag [${tagId}]. Removed tag association.`
              );
            }
          }
        }

        const domain = typeof raw.domain === 'string' && raw.domain.trim()
          ? raw.domain.trim()
          : extractDomain(normalizedUrl);

        const title = typeof raw.title === 'string' && raw.title.trim()
          ? raw.title.trim()
          : generateFallbackTitle(normalizedUrl);

        validBookmarks.push({
          id,
          url: normalizedUrl,
          title,
          domain,
          description: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : undefined,
          favicon: typeof raw.favicon === 'string' && raw.favicon.trim() ? raw.favicon.trim() : undefined,
          previewImage: typeof raw.previewImage === 'string' && raw.previewImage.trim() ? raw.previewImage.trim() : undefined,
          collectionId: effectiveCollectionId,
          tags: effectiveTags,
          isFavourite: Boolean(raw.isFavourite),
          createdAt,
          updatedAt,
        });
      }

      // Upsert bookmarks and tag links using save_bookmark_with_tags RPC
      for (const bm of validBookmarks) {
        const { error } = await client.rpc('save_bookmark_with_tags', {
          p_bookmark: {
            id: bm.id,
            url: bm.url,
            title: bm.title,
            domain: bm.domain,
            description: bm.description || null,
            favicon: bm.favicon || null,
            previewImage: bm.previewImage || null,
            collectionId: bm.collectionId || null,
            isFavourite: bm.isFavourite,
            createdAt: bm.createdAt,
            updatedAt: bm.updatedAt,
          },
          p_tag_ids: bm.tags || [],
        });

        if (error) {
          throw translateSupabaseError(error, { entityType: 'bookmark' });
        }
        report.bookmarksMigrated++;
      }

      // ========================================================================
      // 4. STRICT MULTI-VECTOR VERIFICATION
      // ========================================================================
      options?.onProgress?.('Verifying cloud records and relationships');

      const [vColRes, vTagRes, vBmRes, vBtRes] = await Promise.all([
        client.from('collections').select('id').eq('user_id', trimmedUserId),
        client.from('tags').select('id').eq('user_id', trimmedUserId),
        client.from('bookmarks').select('id, collection_id').eq('user_id', trimmedUserId),
        client.from('bookmark_tags').select('bookmark_id, tag_id').eq('user_id', trimmedUserId),
      ]);

      if (vColRes.error) throw translateSupabaseError(vColRes.error);
      if (vTagRes.error) throw translateSupabaseError(vTagRes.error);
      if (vBmRes.error) throw translateSupabaseError(vBmRes.error);
      if (vBtRes.error) throw translateSupabaseError(vBtRes.error);

      const vCols = new Set<string>((vColRes.data || []).map((c) => c.id));
      const vTags = new Set<string>((vTagRes.data || []).map((t) => t.id));
      const vBms = new Map<string, any>((vBmRes.data || []).map((b) => [b.id, b]));

      const vBtSet = new Set<string>(
        (vBtRes.data || []).map((bt) => `${bt.bookmark_id}:::${bt.tag_id}`)
      );

      // Verify Collection ID coverage
      for (const col of validCollections) {
        if (!vCols.has(col.id)) {
          throw new Error(`Verification failed: Collection [${col.id}] ("${col.name}") was not found in Supabase.`);
        }
      }

      // Verify Tag ID coverage
      for (const tag of validTags) {
        if (!vTags.has(tag.id)) {
          throw new Error(`Verification failed: Tag [${tag.id}] ("${tag.name}") was not found in Supabase.`);
        }
      }

      // Verify Bookmark ID & Relationship coverage
      for (const bm of validBookmarks) {
        const cloudBm = vBms.get(bm.id);
        if (!cloudBm) {
          throw new Error(`Verification failed: Bookmark [${bm.id}] (${bm.url}) was not found in Supabase.`);
        }

        // Verify collection reference matches
        if (bm.collectionId && cloudBm.collection_id !== bm.collectionId) {
          throw new Error(
            `Verification failed: Bookmark [${bm.id}] collection_id (${cloudBm.collection_id}) does not match expected (${bm.collectionId}).`
          );
        }

        // Verify tag links match
        if (bm.tags && bm.tags.length > 0) {
          for (const tagId of bm.tags) {
            const pairKey = `${bm.id}:::${tagId}`;
            if (!vBtSet.has(pairKey)) {
              throw new Error(
                `Verification failed: Association between bookmark [${bm.id}] and tag [${tagId}] missing in cloud.`
              );
            }
          }
        }
      }

      // ========================================================================
      // 5. BACKUP LOCAL DATA (Hard Failure Guarantee)
      // ========================================================================
      options?.onProgress?.('Backing up local data');

      const backupTimestamp = Date.now();
      const backupKey = `shelf_backup_v1_${trimmedUserId}_${backupTimestamp}`;
      try {
        localStorage.setItem(
          backupKey,
          JSON.stringify({
            collections: rawCollections,
            tags: rawTags,
            bookmarks: rawBookmarks,
            backedUpAt: new Date().toISOString(),
          })
        );
      } catch (err) {
        const backupError = `Migration aborted: Failed to create local data backup (${err instanceof Error ? err.message : String(err)}).`;
        report.errors.push(backupError);
        return {
          state: 'failed',
          userId: trimmedUserId,
          report,
          error: backupError,
        };
      }

      // ========================================================================
      // 6. FINALIZE MIGRATION & PERSIST STATUS
      // ========================================================================
      const hasSkippedRecords =
        report.collectionsSkipped > 0 ||
        report.tagsSkipped > 0 ||
        report.bookmarksSkipped > 0;

      if (hasSkippedRecords) {
        const reportKey = `shelf_migration_report_${trimmedUserId}`;
        const reportTimestamp = new Date().toISOString();
        report.timestamp = reportTimestamp;
        report.userId = trimmedUserId;
        try {
          localStorage.setItem(
            reportKey,
            JSON.stringify(report)
          );
        } catch (err) {
          const reportError = `Migration aborted: Failed to persist migration report to localStorage (${err instanceof Error ? err.message : String(err)}).`;
          report.errors.push(reportError);
          return {
            state: 'failed',
            userId: trimmedUserId,
            report,
            error: reportError,
          };
        }

        // Return needs_attention without writing shelf_migrated_v1 completion marker
        return {
          state: 'needs_attention',
          userId: trimmedUserId,
          report,
          error: `Migration completed with ${report.collectionsSkipped + report.tagsSkipped + report.bookmarksSkipped} skipped or conflicting records requiring attention.`,
        };
      }

      // 1. Persist the completion marker successfully
      try {
        localStorage.setItem(`shelf_migrated_v1_${trimmedUserId}`, 'true');
      } catch (err) {
        const markerError = `Failed to persist migration completion marker: ${err instanceof Error ? err.message : String(err)}`;
        report.errors.push(markerError);
        return {
          state: 'failed',
          userId: trimmedUserId,
          report,
          error: markerError,
        };
      }

      // 2. Only after successful marker persistence, remove the old migration report
      try {
        localStorage.removeItem(`shelf_migration_report_${trimmedUserId}`);
      } catch {
        // Non-fatal cleanup warning: report removal failed, but completion marker is safely persisted
      }

      // 3. Clear the old acknowledgement only after the completion marker is safely persisted
      try {
        this.clearMigrationAcknowledgement(trimmedUserId);
      } catch {
        // Non-fatal cleanup warning: acknowledgement cleanup failed, but completion marker is safely persisted
      }

      return {
        state: 'completed',
        userId: trimmedUserId,
        report,
        migratedAt: new Date().toISOString(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      report.errors.push(errorMessage);

      // Invariant: On failure, shelf_migrated_v1_USER is NOT written.
      // Original localStorage data remains 100% untouched.
      return {
        state: 'failed',
        userId: trimmedUserId,
        report,
        error: errorMessage,
      };
    } finally {
      inFlightMigrations.delete(trimmedUserId);
    }
  }
}

// Singleton migration service
export const migrationService = new MigrationService();

/**
 * Convenience helper to run data migration for the current user.
 */
export async function migrateUserData(
  userId: string,
  options?: MigrationOptions
): Promise<MigrationResult> {
  return migrationService.migrateUserData(userId, options);
}

/**
 * Convenience helper to check if the current user has completed cloud migration.
 */
export function isUserMigrated(userId: string): boolean {
  return migrationService.isUserMigrated(userId);
}

/**
 * Convenience helper to retrieve the persisted migration report for a user.
 */
export function getMigrationReport(userId: string): MigrationRecordReport | null {
  return migrationService.getMigrationReport(userId);
}

/**
 * Convenience helper to acknowledge a migration report for a user.
 */
export function acknowledgeMigrationReport(
  userId: string,
  timestamp: string
): { success: boolean; error?: string } {
  return migrationService.acknowledgeMigrationReport(userId, timestamp);
}

/**
 * Convenience helper to check if a user has acknowledged a migration report.
 */
export function isMigrationAcknowledged(userId: string, timestamp?: string): boolean {
  return migrationService.isMigrationAcknowledged(userId, timestamp);
}

/**
 * Convenience helper to clear the migration acknowledgement for a user.
 */
export function clearMigrationAcknowledgement(userId: string): void {
  migrationService.clearMigrationAcknowledgement(userId);
}

/**
 * Convenience helper to check if a user has completed authoritative cloud cutover reconciliation.
 */
export function isUserCutover(userId: string): boolean {
  return migrationService.isUserCutover(userId);
}

/**
 * Convenience helper to persist the cutover marker after successful reconciliation.
 */
export function markUserCutover(userId: string): { success: boolean; error?: string } {
  return migrationService.markUserCutover(userId);
}

/**
 * Convenience helper to reset the cutover marker.
 */
export function resetCutoverMarker(userId: string): void {
  migrationService.resetCutoverMarker(userId);
}
