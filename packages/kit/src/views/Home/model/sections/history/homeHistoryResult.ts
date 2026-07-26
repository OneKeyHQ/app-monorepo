import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';

import { normalizeHomeStoreJson } from '../../store/homeStoreJson';

import type { IHomeHistoryStorePayload } from './homeHistorySourceAdapter';

export type IHomeHistoryStoreResult =
  | { kind: 'empty' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      rowIds: readonly string[];
      data: IHomeRuntimeJsonValue;
      freshness: 'live';
      refresh: 'idle';
    };

export function createHomeHistoryStoreResult(
  payload: IHomeHistoryStorePayload,
): IHomeHistoryStoreResult {
  const data = normalizeHomeStoreJson(payload);
  return data === undefined
    ? { kind: 'error' }
    : {
        kind: 'ready',
        rowIds: payload.data.map((tx) => tx.id),
        data,
        freshness: 'live',
        refresh: 'idle',
      };
}
