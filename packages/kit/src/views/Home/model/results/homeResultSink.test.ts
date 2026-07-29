import { createHomeResultSink } from './homeResultSink';
import { HomeStoreCommitBudget } from './homeStoreCommitBudget';

import type {
  IHomeCurrentResultAuthority,
  IHomeResultAuthority,
} from './homeResultSink';

const authority: IHomeResultAuthority = {
  ownerScopeKey: 'owner-a',
  runtimeInstanceId: 'runtime-a',
  appEpoch: 'epoch-a',
  clientInstanceId: 'client-a',
  sessionId: 'session-a',
  producerInstanceId: 'producer-a',
  sourceId: 'portfolio',
  sourceKey: 'source-a',
  requestSequence: 1,
  sourceRevision: 1,
  requestGroupId: 'group-a',
  taskId: 'task-a',
};

describe('HomeResultSink', () => {
  it('rejects stale authority before materialization', () => {
    const materialize = jest.fn((wireValue: string) => ({
      model: wireValue,
      dataRevision: 1,
    }));
    const sink = createHomeResultSink<string, string>({
      authority,
      priority: 'critical',
      commitBudget: new HomeStoreCommitBudget(),
      getCurrentAuthority: () => undefined,
      materialize,
      commit: jest.fn(),
    });

    expect(
      sink.publish({ phase: 'final', revision: 1, wireValue: 'value' }),
    ).toEqual({ kind: 'rejected', reason: 'sessionMismatch' });
    expect(materialize).not.toHaveBeenCalled();
  });

  it('buffers only the hidden final and materializes after visibility returns', async () => {
    const drains: Array<() => void> = [];
    const committed: string[] = [];
    let current: IHomeCurrentResultAuthority = {
      ...authority,
      surfaceVisibility: 'hidden',
    };
    const sink = createHomeResultSink<string, string>({
      authority,
      priority: 'critical',
      commitBudget: new HomeStoreCommitBudget({
        scheduleVisibleDrain: (callback) => {
          drains.push(callback);
          return () => undefined;
        },
      }),
      getCurrentAuthority: () => current,
      materialize: (wireValue) => ({
        model: wireValue,
        dataRevision: 1,
      }),
      commit: ({ materialized }) => committed.push(materialized.model),
    });

    expect(
      sink.publish({ phase: 'final', revision: 1, wireValue: 'final' }),
    ).toEqual({ kind: 'buffered' });
    current = { ...current, surfaceVisibility: 'visible' };
    expect(sink.flushBuffered()).toMatchObject({ kind: 'accepted' });
    await Promise.resolve();
    drains.shift()?.();

    expect(committed).toEqual(['final']);
  });

  it('automatically retries a final when commit capacity becomes available', async () => {
    const drains: Array<() => void> = [];
    const commitBudget = new HomeStoreCommitBudget({
      maxBuffered: 1,
      scheduleVisibleDrain: (callback) => {
        drains.push(callback);
        return () => undefined;
      },
    });
    const committed: string[] = [];
    commitBudget.submit({
      authority,
      phase: 'final',
      priority: 'critical',
      publicationId: 'occupied',
      publicationRevision: 1,
      materialized: { model: 'occupied', dataRevision: 'occupied' },
      commit: () => committed.push('occupied'),
    });
    const sink = createHomeResultSink<string, string>({
      authority,
      priority: 'critical',
      commitBudget,
      getCurrentAuthority: () => ({
        ...authority,
        surfaceVisibility: 'visible',
      }),
      materialize: (wireValue) => ({
        model: wireValue,
        dataRevision: wireValue,
      }),
      commit: ({ materialized }) => committed.push(materialized.model),
    });

    expect(
      sink.publish({ phase: 'final', revision: 2, wireValue: 'final' }),
    ).toEqual({ kind: 'backpressured', retryable: true });
    drains.shift()?.();
    await Promise.resolve();
    await Promise.resolve();
    drains.shift()?.();

    expect(committed).toEqual(['occupied', 'final']);
  });

  it('buffers a final when the surface hides during materialization', async () => {
    const drains: Array<() => void> = [];
    const committed: string[] = [];
    let resolveFirstMaterialization:
      | ((value: { model: string; dataRevision: number }) => void)
      | undefined;
    let materializationCount = 0;
    let current: IHomeCurrentResultAuthority = {
      ...authority,
      surfaceVisibility: 'visible',
    };
    const sink = createHomeResultSink<string, string>({
      authority,
      priority: 'critical',
      commitBudget: new HomeStoreCommitBudget({
        scheduleVisibleDrain: (callback) => {
          drains.push(callback);
          return () => undefined;
        },
      }),
      getCurrentAuthority: () => current,
      materialize: (wireValue) => {
        materializationCount += 1;
        if (materializationCount === 1) {
          return new Promise((resolve) => {
            resolveFirstMaterialization = resolve;
          });
        }
        return { model: wireValue, dataRevision: materializationCount };
      },
      commit: ({ materialized }) => committed.push(materialized.model),
    });

    expect(
      sink.publish({ phase: 'final', revision: 1, wireValue: 'final' }),
    ).toMatchObject({ kind: 'accepted' });
    current = { ...current, surfaceVisibility: 'hidden' };
    resolveFirstMaterialization?.({ model: 'final', dataRevision: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(committed).toEqual([]);

    current = { ...current, surfaceVisibility: 'visible' };
    expect(sink.flushBuffered()).toMatchObject({ kind: 'accepted' });
    await Promise.resolve();
    await Promise.resolve();
    drains.shift()?.();

    expect(committed).toEqual(['final']);
    expect(materializationCount).toBe(2);
  });
});
