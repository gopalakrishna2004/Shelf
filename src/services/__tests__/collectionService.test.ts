import { describe, it, expect, beforeEach } from 'vitest';
import { LocalCollectionRepository } from '../collectionService';

describe('LocalCollectionRepository', () => {
  let repository: LocalCollectionRepository;
  const userA = 'user_alpha_123';
  const userB = 'user_beta_456';

  beforeEach(() => {
    localStorage.clear();
    repository = new LocalCollectionRepository();
  });

  it('creates collections with unique IDs, trimmed names, and timestamps', async () => {
    const col = await repository.createCollection(userA, {
      name: '  Design Systems  ',
      description: 'Foundations and components',
    });

    expect(col.id).toBeDefined();
    expect(col.name).toBe('Design Systems');
    expect(col.description).toBe('Foundations and components');
    expect(col.createdAt).toBeDefined();
    expect(col.updatedAt).toBeDefined();

    const stored = await repository.getCollections(userA);
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe(col.id);
    expect(stored[0].name).toBe('Design Systems');
  });

  it('rejects empty or whitespace-only collection names', async () => {
    await expect(repository.createCollection(userA, { name: '' })).rejects.toThrow(
      'Collection name cannot be empty.'
    );
    await expect(repository.createCollection(userA, { name: '    ' })).rejects.toThrow(
      'Collection name cannot be empty.'
    );
  });

  it('prevents duplicate collection names using case-insensitive comparison', async () => {
    await repository.createCollection(userA, { name: 'Reading List' });

    await expect(
      repository.createCollection(userA, { name: 'reading list' })
    ).rejects.toThrow('A collection named "reading list" already exists.');

    await expect(
      repository.createCollection(userA, { name: '  READING LIST  ' })
    ).rejects.toThrow('A collection named "READING LIST" already exists.');
  });

  it('retrieves collection by ID', async () => {
    const created = await repository.createCollection(userA, { name: 'Typography' });
    const found = await repository.getCollectionById(userA, created.id);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe('Typography');

    const notFound = await repository.getCollectionById(userA, 'non_existent_id');
    expect(notFound).toBeNull();
  });

  it('renames a collection, preserves ID and createdAt, and updates updatedAt', async () => {
    const created = await repository.createCollection(userA, {
      name: 'Tech',
      description: 'Original note',
    });

    const updated = await repository.updateCollection(userA, created.id, {
      name: 'Technology & AI',
      description: 'Updated note',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.name).toBe('Technology & AI');
    expect(updated.description).toBe('Updated note');
    expect(new Date(updated.updatedAt!).getTime()).toBeGreaterThanOrEqual(
      new Date(created.createdAt).getTime()
    );

    const reloaded = await repository.getCollectionById(userA, created.id);
    expect(reloaded?.name).toBe('Technology & AI');
  });

  it('prevents renaming to an existing collection name from another collection', async () => {
    await repository.createCollection(userA, { name: 'Alpha' });
    const col2 = await repository.createCollection(userA, { name: 'Beta' });

    await expect(
      repository.updateCollection(userA, col2.id, { name: 'alpha' })
    ).rejects.toThrow('A collection named "alpha" already exists.');

    // Renaming to its own existing name (different casing) is permitted
    const selfRenamed = await repository.updateCollection(userA, col2.id, { name: 'BETA' });
    expect(selfRenamed.name).toBe('BETA');
  });

  it('deletes a collection cleanly from storage', async () => {
    const col = await repository.createCollection(userA, { name: 'Temporary' });
    let list = await repository.getCollections(userA);
    expect(list.length).toBe(1);

    await repository.deleteCollection(userA, col.id);

    list = await repository.getCollections(userA);
    expect(list.length).toBe(0);

    const found = await repository.getCollectionById(userA, col.id);
    expect(found).toBeNull();
  });

  it('isolates collection data strictly between different authenticated users', async () => {
    await repository.createCollection(userA, { name: 'User A Library' });
    await repository.createCollection(userB, { name: 'User B Library' });

    const collectionsA = await repository.getCollections(userA);
    const collectionsB = await repository.getCollections(userB);

    expect(collectionsA.length).toBe(1);
    expect(collectionsA[0].name).toBe('User A Library');

    expect(collectionsB.length).toBe(1);
    expect(collectionsB[0].name).toBe('User B Library');
  });

  it('prevents unauthenticated writes', async () => {
    await expect(repository.createCollection('', { name: 'No User' })).rejects.toThrow(
      'You must be signed in to create a collection.'
    );
    await expect(repository.updateCollection('  ', 'some-id', { name: 'No User' })).rejects.toThrow(
      'You must be signed in to update a collection.'
    );
    await expect(repository.deleteCollection('', 'some-id')).rejects.toThrow(
      'You must be signed in to delete a collection.'
    );
  });

  it('handles corrupted localStorage data defensively', async () => {
    localStorage.setItem(`shelf_collections_${userA}`, 'not-valid-json{{{');
    const result = await repository.getCollections(userA);
    expect(result).toEqual([]);

    localStorage.setItem(
      `shelf_collections_${userA}`,
      JSON.stringify([{ invalid: 'object' }, { id: 'valid_id', name: 'Valid Shelf' }])
    );
    const filtered = await repository.getCollections(userA);
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('Valid Shelf');
  });
});
