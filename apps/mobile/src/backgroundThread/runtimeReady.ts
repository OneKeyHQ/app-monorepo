export type IBackgroundThreadReadyPayload = {
  runtime: 'background';
  status: 'ready';
  protocolVersion: '1';
  bootId: string;
  ts: number;
};

export type IBackgroundThreadFailedPayload = {
  runtime: 'background';
  status: 'failed';
  protocolVersion: '1';
  bootId: string;
  ts: number;
  errorMessage?: string;
};

export type IBackgroundThreadRuntimePayload =
  | IBackgroundThreadReadyPayload
  | IBackgroundThreadFailedPayload;

export const BACKGROUND_THREAD_READY_PROTOCOL_VERSION = '1';
// SharedStore key holding the latched bg-runtime ready/failed payload. Read
// synchronously by main via `sharedStore.get` (non-deleting, so readiness
// survives any number of reads — unlike the old read-and-delete slot).
export const BACKGROUND_THREAD_READY_KEY =
  '@onekey/mobile/background-thread/runtime-ready';
// SharedRPC content-less wake ping fired right after the bg runtime updates
// its latched readiness in SharedStore. SharedStore has no notify, so this
// ping is what edge-wakes main to re-read `BACKGROUND_THREAD_READY_KEY` and
// flush its queued cross-runtime calls. The ping's value is irrelevant.
export const BACKGROUND_THREAD_READY_WAKE_KEY =
  '@onekey/mobile/background-thread/runtime-ready-wake';

const BACKGROUND_THREAD_BOOT_ID = `${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 10)}`;

export function buildBackgroundThreadReadyPayload(): IBackgroundThreadReadyPayload {
  return {
    runtime: 'background',
    status: 'ready',
    protocolVersion: BACKGROUND_THREAD_READY_PROTOCOL_VERSION,
    bootId: BACKGROUND_THREAD_BOOT_ID,
    ts: Date.now(),
  };
}

export function buildBackgroundThreadFailedPayload(
  errorMessage?: string,
): IBackgroundThreadFailedPayload {
  return {
    runtime: 'background',
    status: 'failed',
    protocolVersion: BACKGROUND_THREAD_READY_PROTOCOL_VERSION,
    bootId: BACKGROUND_THREAD_BOOT_ID,
    ts: Date.now(),
    errorMessage,
  };
}

export function serializeBackgroundThreadReadyPayload(
  payload: IBackgroundThreadReadyPayload = buildBackgroundThreadReadyPayload(),
) {
  return JSON.stringify(payload);
}

export function serializeBackgroundThreadRuntimePayload(
  payload: IBackgroundThreadRuntimePayload = buildBackgroundThreadReadyPayload(),
) {
  return JSON.stringify(payload);
}

export function parseBackgroundThreadRuntimePayload(
  value: string | number | boolean | undefined,
): IBackgroundThreadRuntimePayload | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      value,
    ) as Partial<IBackgroundThreadRuntimePayload>;
    if (
      payload.runtime !== 'background' ||
      (payload.status !== 'ready' && payload.status !== 'failed') ||
      payload.protocolVersion !== BACKGROUND_THREAD_READY_PROTOCOL_VERSION ||
      typeof payload.bootId !== 'string' ||
      typeof payload.ts !== 'number'
    ) {
      return undefined;
    }

    if (
      payload.status === 'failed' &&
      payload.errorMessage !== undefined &&
      typeof payload.errorMessage !== 'string'
    ) {
      return undefined;
    }

    return payload as IBackgroundThreadRuntimePayload;
  } catch {
    return undefined;
  }
}

export function parseBackgroundThreadReadyPayload(
  value: string | number | boolean | undefined,
): IBackgroundThreadReadyPayload | undefined {
  const payload = parseBackgroundThreadRuntimePayload(value);
  if (!payload || payload.status !== 'ready') {
    return undefined;
  }

  return payload;
}
