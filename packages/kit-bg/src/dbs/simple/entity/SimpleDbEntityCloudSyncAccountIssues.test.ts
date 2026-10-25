import { SimpleDbEntityCloudSyncAccountIssues } from './SimpleDbEntityCloudSyncAccountIssues';

jest.mock('../base/SimpleDbEntityBase', () => ({
  SimpleDbEntityBase: class SimpleDbEntityBaseMock {
    data: unknown;
    async setRawData(builder: (previous: unknown) => unknown) {
      this.data = builder(this.data);
    }
  },
}));

describe('Cloud account issue aggregation', () => {
  test('later successful records preserve earlier errors until that exact ID resolves', async () => {
    const entity = new SimpleDbEntityCloudSyncAccountIssues();
    expect(
      await entity.updateIssues({
        spaceId: 'A',
        updates: [
          { id: 'future', issue: 'needsUpdate' },
          { id: 'missing-wallet', issue: 'pending' },
        ],
      }),
    ).toEqual({ needsUpdate: 1, pending: 1, conflicts: 0, rejected: 0 });
    expect(
      await entity.updateIssues({
        spaceId: 'A',
        updates: [{ id: 'unrelated-success' }],
      }),
    ).toEqual({ needsUpdate: 1, pending: 1, conflicts: 0, rejected: 0 });
    expect(
      await entity.updateIssues({
        spaceId: 'A',
        updates: [{ id: 'missing-wallet' }],
      }),
    ).toEqual({ needsUpdate: 1, pending: 0, conflicts: 0, rejected: 0 });
    expect(await entity.updateIssues({ spaceId: 'B', updates: [] })).toEqual({
      needsUpdate: 0,
      pending: 0,
      conflicts: 0,
      rejected: 0,
    });
  });

  test('rejects unsafe identities without losing previously persisted counts', async () => {
    const entity = new SimpleDbEntityCloudSyncAccountIssues();
    await entity.updateIssues({
      spaceId: 'A',
      updates: [{ id: 'valid', issue: 'conflicts' }],
    });
    await expect(
      entity.updateIssues({
        spaceId: 'A',
        updates: [{ id: '__proto__', issue: 'pending' }],
      }),
    ).rejects.toThrow('Invalid Cloud issue identity');
    expect(await entity.updateIssues({ spaceId: 'A', updates: [] })).toEqual({
      needsUpdate: 0,
      pending: 0,
      conflicts: 1,
      rejected: 0,
    });
  });

  test('keeps 10000 record issues out of UI state and clears only resolved records', async () => {
    const entity = new SimpleDbEntityCloudSyncAccountIssues();
    const updates = Array.from({ length: 10_000 }, (_, index) => ({
      id: `record-${index}`,
      issue: 'pending' as const,
    }));
    expect(await entity.updateIssues({ spaceId: 'A', updates })).toEqual({
      needsUpdate: 0,
      pending: 10_000,
      conflicts: 0,
      rejected: 0,
    });
    expect(
      await entity.updateIssues({
        spaceId: 'A',
        updates: updates.slice(0, 50).map(({ id }) => ({ id })),
      }),
    ).toEqual({ needsUpdate: 0, pending: 9950, conflicts: 0, rejected: 0 });
  });
});
