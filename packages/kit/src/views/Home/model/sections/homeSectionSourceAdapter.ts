import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';

import type {
  IHomeSectionCoordinatorEvent,
  IHomeSectionSourceIdentity,
} from './homeSectionCoordinator';

export type IScopedResourceState<T extends IHomeRuntimeJsonValue> =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'partial';
      data: T;
      coverageFingerprint: string;
    }
  | {
      status: 'success';
      data: T;
      coverageFingerprint: string;
    }
  | { status: 'empty'; coverageFingerprint: string }
  | {
      status: 'error';
      errorKind:
        | 'source'
        | 'transport'
        | 'schemaMismatch'
        | 'runtimeUnavailable';
    }
  | { status: 'stopped' };

function adaptHomeSectionSourceState<T extends IHomeRuntimeJsonValue>({
  getRowIds,
  identity,
  state,
}: {
  getRowIds: (data: T) => readonly string[];
  identity: IHomeSectionSourceIdentity;
  state: IScopedResourceState<T>;
}): IHomeSectionCoordinatorEvent<T> | undefined {
  switch (state.status) {
    case 'idle':
    case 'loading':
      return { ...identity, kind: 'loading' };
    case 'partial':
      return { ...identity, kind: 'partial' };
    case 'success':
      return {
        ...identity,
        kind: 'complete',
        result: {
          kind: 'success',
          data: state.data,
          rowIds: getRowIds(state.data),
        },
      };
    case 'empty':
      return {
        ...identity,
        kind: 'complete',
        result: { kind: 'empty' },
      };
    case 'error':
      return { ...identity, kind: 'error' };
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
}: {
  data: T;
  getRowIds: (data: T) => readonly string[];
  identity: IHomeSectionSourceIdentity;
  refresh: 'idle' | 'refreshing';
}): IHomeSectionCoordinatorEvent<T> {
  return {
    ...identity,
    kind: 'seedConfirmed',
    data,
    rowIds: getRowIds(data),
    refresh,
  };
}

export { adaptHomeSectionSourceState, createHomeSectionConfirmedSeed };
