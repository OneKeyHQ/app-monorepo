import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';

import { normalizeHomeStoreJson } from '../../store/homeStoreJson';

import type { IHomeHistoryStorePayload } from './homeHistorySourceAdapter';
import type { IHomeSectionSourceRequestHandle } from '../../react/useHomeStoreSourcePublisher';

type IHomeHistoryStoreResult =
  | { kind: 'empty' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      rowIds: readonly string[];
      data: IHomeRuntimeJsonValue;
      freshness: 'live';
      refresh: 'idle';
    };

type IHomeHistoryRequestGateway = {
  begin: () => IHomeSectionSourceRequestHandle;
  complete: (
    handle: IHomeSectionSourceRequestHandle,
    result: IHomeHistoryStoreResult,
  ) => void;
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

export async function runHomeHistoryStoreRequest<TResponse>({
  afterSuccess,
  gateway,
  isCurrent,
  load,
  project,
}: {
  afterSuccess?: (response: TResponse) => Promise<void> | void;
  gateway: IHomeHistoryRequestGateway;
  isCurrent: () => boolean;
  load: () => Promise<TResponse>;
  project: (response: TResponse) => IHomeHistoryStorePayload;
}): Promise<{ accepted: boolean; response?: TResponse }> {
  const handle = gateway.begin();
  let response: TResponse;
  try {
    response = await load();
    if (!isCurrent()) {
      gateway.complete(handle, { kind: 'error' });
      return { accepted: false };
    }
    const payload = project(response);
    gateway.complete(handle, createHomeHistoryStoreResult(payload));
  } catch (error) {
    gateway.complete(handle, { kind: 'error' });
    throw error;
  }
  if (!isCurrent()) {
    return { accepted: false };
  }
  await afterSuccess?.(response);
  return { accepted: true, response };
}

export type { IHomeHistoryRequestGateway, IHomeHistoryStoreResult };
