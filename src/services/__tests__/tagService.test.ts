import { describe, it, expect, beforeEach } from 'vitest';
import { LocalTagRepository } from '../tagService';

describe('LocalTagRepository', () => {
  let repository: LocalTagRepository;
  const userA = 'user_alpha_123';
  const userB = 'user_beta_456';

  beforeEach(() => {
    localStorage.clear();
    repository = new LocalTagRepository();
  });

  it('creates tags with unique IDs, trimmed names, and timestamps', async () => {
    const tag = await repository.createTag(userA, {
      name: '  Design Systems  ',
    });

    expect(tag.id).toBeDefined();
    expect(tag.name).toBe('Design Systems');
    expect(tag.createdAt).toBeDefined();
    expect(tag.updatedAt).toBeDefined();

    const stored = await repository.getTags(userA);
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe(tag.id);
    expect(stored[0].name).toBe('Design Systems');
  });

  it('rejects empty or whitespace-only tag names', async () => {
    await expect(repository.createTag(userA, { name: '' })).rejects.toThrow(
      'Tag name cannot be empty.'
    );
    await expect(repository.createTag(userA, { name: '    ' })).rejects.toThrow(
      'Tag name cannot be empty.'
    );
  });

  it('prevents duplicate tag names using case-insensitive comparison', async () => {
    await repository.createTag(userA, { name: 'Reading' });

    await expect(
      repository.createTag(userA, { name: 'reading' })
    ).rejects.toThrow('A tag named "reading" already exists.');

    await expect(
      repository.createTag(userA, { name: '  READING  ' })
    ).rejects.toThrow('A tag named "READING" already exists.');
  });

  it('retrieves tag by ID', async () => {
    const created = await repository.createTag(userA, { name: 'Typography' });
    const found = await repository.getTagById(userA, created.id);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe('Typography');
  });

  it('renames a tag while preserving immutable ID and createdAt timestamp', async () => {
    const initial = await repository.createTag(userA, { name: 'AI Models' });

    const updated = await repository.updateTag(userA, initial.id, {
      name: 'Artificial Intelligence',
    });

    expect(updated.id).toBe(initial.id);
    expect(updated.createdAt).toBe(initial.createdAt);
    expect(updated.name).toBe('Artificial Intelligence');

    const stored = await repository.getTags(userA);
    expect(stored[0].name).toBe('Artificial Intelligence');
  });

  it('rejects renaming to duplicate tag name', async () => {
    const tag1 = await repository.createTag(userA, { name: 'Rust' });
    await repository.createTag(userA, { name: 'TypeScript' });

    await expect(
      repository.updateTag(userA, tag1.id, { name: 'typescript' })
    ).rejects.toThrow('A tag named "typescript" already exists.');
  });

  it('allows saving with the exact same name during rename (no duplicate conflict with self)', async () => {
    const tag = await repository.createTag(userA, { name: 'Architecture' });

    const updated = await repository.updateTag(userA, tag.id, {
      name: 'Architecture',
    });

    expect(updated.name).toBe('Architecture');
  });

  it('deletes a tag cleanly from repository', async () => {
    const tag1 = await repository.createTag(userA, { name: 'Frontend' });
    const tag2 = await repository.createTag(userA, { name: 'Backend' });

    await repository.deleteTag(userA, tag1.id);

    const remaining = await repository.getTags(userA);
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(tag2.id);
    expect(remaining[0].name).toBe('Backend');
  });

  it('enforces strict tenant isolation across multiple users', async () => {
    await repository.createTag(userA, { name: 'User A Tag' });
    await repository.createTag(userB, { name: 'User B Tag' });

    // Same name can exist across different users
    await repository.createTag(userB, { name: 'User A Tag' });

    const tagsA = await repository.getTags(userA);
    const tagsB = await repository.getTags(userB);

    expect(tagsA.length).toBe(1);
    expect(tagsA[0].name).toBe('User A Tag');

    expect(tagsB.length).toBe(2);
    expect(tagsB.map((t) => t.name)).toContain('User B Tag');
    expect(tagsB.map((t) => t.name)).toContain('User A Tag');
  });

  it('throws when attempting unauthenticated access', async () => {
    await expect(repository.getTags('')).resolves.toEqual([]);
    await expect(repository.createTag('', { name: 'Test' })).rejects.toThrow(
      'You must be signed in to create a tag.'
    );
  });
});
