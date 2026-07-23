import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';

import type {
  IHomeSectionCoordinatorEvent,
  IHomeSectionSourceIdentity,
} from './homeSectionCoordinator';

export type IScopedResourceState<T extends IHomeRuntimeJsonValue> =
  | { status: 'idle'; requestSeq: 0 }
  | { status: 'loading'; requestSeq: number }
  | {
      status: 'partial';
      requestSeq: number;
      data: T;
      coverageFingerprint: string;
    }
  | {
      status: 'success';
      requestSeq: number;
      data: T;
      coverageFingerprint: string;
    }
  | { status: 'empty'; requestSeq: number; coverageFingerprint: string }
  | {
      status: 'error';
      requestSeq: number;
      errorKind:
        | 'source'
        | 'transport'
        | 'schemaMismatch'
        | 'runtimeUnavailable';
    }
  | { status: 'stopped'; requestSeq: number };

function adaptHomeSectionSourceState<T extends IHomeRuntimeJsonValue>({
  getRowIds,
  identity,
  state,
}: {
  getRowIds: (data: T) => readonly string[];
  identity: IHomeSectionSourceIdentity;
  state: IScopedResourceState<T>;
}): IHomeSectionCoordinatorEvent<T> | undefined {
  const base = {
    ...identity,
    requestSeq: state.requestSeq,
  };
  switch (state.status) {
    case 'idle':
    case 'loading':
      return { ...base, kind: 'loading' };
    case 'partial':
      return {
        ...base,
        kind: 'partial',
        coverageFingerprint: state.coverageFingerprint,
      };
    case 'success':
      return {
        ...base,
        kind: 'complete',
        result: {
          kind: 'success',
          data: state.data,
          rowIds: getRowIds(state.data),
        },
        coverageFingerprint: state.coverageFingerprint,
      };
    case 'empty':
      return {
        ...base,
        kind: 'complete',
        result: { kind: 'empty' },
        coverageFingerprint: state.coverageFingerprint,
      };
    case 'error':
      return { ...base, kind: 'error', errorKind: state.errorKind };
    case 'stopped':
      return undefined;
    default:
      return undefined;
  }
}

function createHomeSectionConfirmedSeed<T>({
  data,
  getRowIds,
  identity,
  refresh,
  requestSeq,
}: {
  data: T;
  getRowIds: (data: T) => readonly string[];
  identity: IHomeSectionSourceIdentity;
  refresh: 'idle' | 'refreshing';
  requestSeq: number;
}): IHomeSectionCoordinatorEvent<T> {
  return {
    ...identity,
    kind: 'seedConfirmed',
    requestSeq,
    data,
    rowIds: getRowIds(data),
    refresh,
  };
}

export { adaptHomeSectionSourceState, createHomeSectionConfirmedSeed };
