import { HomeStoreCommitBudget } from './homeStoreCommitBudget';

import type { IHomeResultAuthority } from './homeResultSink';

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

describe('HomeStoreCommitBudget', () => {
  it('commits at most one visible publication per scheduled drain', () => {
    const drains: Array<() => void> = [];
    const committed: string[] = [];
    const budget = new HomeStoreCommitBudget({
      maxPerDispatch: 1,
      scheduleVisibleDrain: (callback) => {
        drains.push(callback);
        return () => undefined;
      },
    });
    const submit = (publicationId: string, sourceId: string) =>
      budget.submit({
        authority: {
          ...authority,
          requestGroupId: `group:${sourceId}`,
          sourceId,
          sourceKey: sourceId,
        },
        materialized: { model: publicationId, dataRevision: publicationId },
        phase: 'final',
        priority: 'critical',
        publicationId,
        publicationRevision: 1,
        commit: () => committed.push(publicationId),
      });

    expect(submit('portfolio-final', 'portfolio')).toBe(true);
    expect(submit('nft-final', 'nft')).toBe(true);
    drains.shift()?.();
    expect(committed).toEqual(['portfolio-final']);
    drains.shift()?.();
    expect(committed).toEqual(['portfolio-final', 'nft-final']);
  });

  it('coalesces an uncommitted intermediate into its final', () => {
    const drains: Array<() => void> = [];
    const committed: string[] = [];
    const budget = new HomeStoreCommitBudget({
      scheduleVisibleDrain: (callback) => {
        drains.push(callback);
        return () => undefined;
      },
    });
    const submit = (
      publicationId: string,
      phase: 'intermediate' | 'final',
      revision: number,
    ) =>
      budget.submit({
        authority,
        materialized: { model: publicationId, dataRevision: publicationId },
        phase,
        priority: 'critical',
        publicationId,
        publicationRevision: revision,
        commit: () => committed.push(publicationId),
      });

    submit('partial', 'intermediate', 1);
    submit('final', 'final', 2);
    drains.shift()?.();

    expect(committed).toEqual(['final']);
  });

  it('drops a queued publication when a newer source key owns the lane', () => {
    const drains: Array<() => void> = [];
    const committed: string[] = [];
    const budget = new HomeStoreCommitBudget({
      scheduleVisibleDrain: (callback) => {
        drains.push(callback);
        return () => undefined;
      },
    });
    const submit = (
      publicationId: string,
      sourceKey: string,
      requestSequence: number,
    ) =>
      budget.submit({
        authority: {
          ...authority,
          requestSequence,
          sourceKey,
          taskId: publicationId,
        },
        materialized: { model: publicationId, dataRevision: publicationId },
        phase: 'final',
        priority: 'critical',
        publicationId,
        publicationRevision: 1,
        commit: () => committed.push(publicationId),
      });

    submit('stale', 'portfolio:old', 1);
    submit('current', 'portfolio:new', 2);
    drains.shift()?.();

    expect(committed).toEqual(['current']);
  });
});
