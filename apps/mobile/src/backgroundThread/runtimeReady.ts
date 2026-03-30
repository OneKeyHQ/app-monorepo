export type IBackgroundThreadReadyPayload = {
  runtime: 'background';
  status: 'ready';
  protocolVersion: '1';
  ts: number;
};

export const BACKGROUND_THREAD_READY_PROTOCOL_VERSION = '1';
export const BACKGROUND_THREAD_READY_KEY =
  '@onekey/mobile/background-thread/runtime-ready';

export function buildBackgroundThreadReadyPayload(): IBackgroundThreadReadyPayload {
  return {
    runtime: 'background',
    status: 'ready',
    protocolVersion: BACKGROUND_THREAD_READY_PROTOCOL_VERSION,
    ts: Date.now(),
  };
}

export function serializeBackgroundThreadReadyPayload(
  payload: IBackgroundThreadReadyPayload = buildBackgroundThreadReadyPayload(),
) {
  return JSON.stringify(payload);
}

export function parseBackgroundThreadReadyPayload(
  value: string | number | boolean | undefined,
): IBackgroundThreadReadyPayload | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const payload = JSON.parse(value) as Partial<IBackgroundThreadReadyPayload>;
    if (
      payload.runtime !== 'background' ||
      payload.status !== 'ready' ||
      payload.protocolVersion !== BACKGROUND_THREAD_READY_PROTOCOL_VERSION ||
      typeof payload.ts !== 'number'
    ) {
      return undefined;
    }

    return payload as IBackgroundThreadReadyPayload;
  } catch {
    return undefined;
  }
}
