import type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

export type IHomePreparedDisplaySnapshotResult = {
  displaySnapshot: IPreparedHomeDisplaySnapshot | undefined;
  ownerScopeKey: string;
};

export type IHomePreparedDisplaySnapshotHandle =
  | {
      kind: 'ready';
      result: IHomePreparedDisplaySnapshotResult;
    }
  | {
      kind: 'pending';
      ownerScopeKey: string;
      task: Promise<IHomePreparedDisplaySnapshotResult>;
    };
