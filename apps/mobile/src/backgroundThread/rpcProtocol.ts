export type IBackgroundThreadTransportState =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'failed'
  | 'fallback-local';

export type IBackgroundThreadServiceCallRequest = {
  type: 'service-call';
  method: string;
  params: Array<any>;
  sync: boolean;
};

export type IBackgroundThreadResponsePayload = {
  ok: boolean;
  result?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};

export const BACKGROUND_THREAD_REQUEST_KEY_PREFIX = 'onekey:bg:req:';
export const BACKGROUND_THREAD_RESPONSE_KEY_PREFIX = 'onekey:bg:res:';

export function buildBackgroundThreadRequestKey(callId: string) {
  return `${BACKGROUND_THREAD_REQUEST_KEY_PREFIX}${callId}`;
}

export function buildBackgroundThreadResponseKey(callId: string) {
  return `${BACKGROUND_THREAD_RESPONSE_KEY_PREFIX}${callId}`;
}

export function parseBackgroundThreadCallId(
  key: string,
  prefix: string,
): string | undefined {
  if (!key.startsWith(prefix)) {
    return undefined;
  }

  const callId = key.slice(prefix.length);
  if (!callId) {
    return undefined;
  }

  return callId;
}

export function serializeBackgroundThreadRequest(
  payload: IBackgroundThreadServiceCallRequest,
) {
  return JSON.stringify(payload);
}

export function parseBackgroundThreadRequest(
  value: string | number | boolean | undefined,
): IBackgroundThreadServiceCallRequest | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const payload = JSON.parse(value) as Partial<IBackgroundThreadServiceCallRequest>;
    if (
      payload.type !== 'service-call' ||
      typeof payload.method !== 'string' ||
      !Array.isArray(payload.params) ||
      typeof payload.sync !== 'boolean'
    ) {
      return undefined;
    }

    return payload as IBackgroundThreadServiceCallRequest;
  } catch {
    return undefined;
  }
}

export function serializeBackgroundThreadResponse(
  payload: IBackgroundThreadResponsePayload,
) {
  return JSON.stringify(payload);
}

export function parseBackgroundThreadResponse(
  value: string | number | boolean | undefined,
): IBackgroundThreadResponsePayload | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const payload = JSON.parse(value) as Partial<IBackgroundThreadResponsePayload>;
    if (typeof payload.ok !== 'boolean') {
      return undefined;
    }

    if (
      payload.error &&
      (typeof payload.error !== 'object' ||
        typeof payload.error.message !== 'string' ||
        typeof payload.error.name !== 'string' ||
        (payload.error.stack !== undefined &&
          typeof payload.error.stack !== 'string'))
    ) {
      return undefined;
    }

    return payload as IBackgroundThreadResponsePayload;
  } catch {
    return undefined;
  }
}
