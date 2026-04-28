import type {
  IInjectedProviderNamesStrings,
  IJsBridgeMessagePayload,
} from '@onekeyfe/cross-inpage-provider-types';

export type IBackgroundThreadTransportState =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'remote-broken';

export type IBackgroundThreadBridgeChannel = 'dapp' | 'webEmbed';

export type IBackgroundThreadServiceCallRequest = {
  type: 'service-call';
  method: string;
  params: Array<any>;
  sync: boolean;
};

export type IBackgroundThreadBridgeCallRequest = {
  type: 'bridge-call';
  payload: IJsBridgeMessagePayload;
};

export type IBackgroundThreadBridgeConnectRequest = {
  type: 'bridge-connect';
  channel: IBackgroundThreadBridgeChannel;
  connected: boolean;
  origin?: string;
  globalOnMessageEnabled: boolean;
};

export type IBackgroundThreadAppEventRequest = {
  type: 'app-event';
  eventName: string;
  payload: unknown;
  /** appEventBus nodeId of the originating runtime; used to skip self-echo. */
  originNodeId?: string;
};

export type IBackgroundThreadRequest =
  | IBackgroundThreadServiceCallRequest
  | IBackgroundThreadBridgeCallRequest
  | IBackgroundThreadBridgeConnectRequest
  | IBackgroundThreadAppEventRequest;

export type IBackgroundThreadJotaiStateBroadcastPayload = {
  name: string;
  payload: any;
};

export type IBackgroundThreadAppEventBroadcastPayload = {
  eventName: string;
  payload: unknown;
  /** appEventBus nodeId of the originating runtime; used to skip self-echo. */
  originNodeId?: string;
};

export type IBackgroundThreadBridgeSendPayload = {
  channel: IBackgroundThreadBridgeChannel;
  scope: IInjectedProviderNamesStrings;
  data: unknown;
  targetOrigin?: string;
};

export type IBackgroundThreadBridgeStatePayload = {
  channel: IBackgroundThreadBridgeChannel;
  connected: boolean;
  origin?: string;
  globalOnMessageEnabled: boolean;
};

export type IBackgroundThreadResponseErrorPayload = {
  name: string;
  message: string;
  stack?: string;
  // Preserve OneKeyError metadata across RPC so toast/i18n/dedup keep working.
  autoToast?: boolean;
  className?: string;
  code?: string | number;
  key?: string;
  requestId?: string;
  httpStatusCode?: number;
  constructorName?: string;
};

export type IBackgroundThreadResponsePayload = {
  ok: boolean;
  result?: unknown;
  error?: IBackgroundThreadResponseErrorPayload;
};

export const BACKGROUND_THREAD_REQUEST_KEY_PREFIX = 'onekey:bg:req:';
export const BACKGROUND_THREAD_RESPONSE_KEY_PREFIX = 'onekey:bg:res:';
export const BACKGROUND_THREAD_JOTAI_STATE_KEY_PREFIX = 'onekey:bg:jotai:';
export const BACKGROUND_THREAD_APP_EVENT_KEY_PREFIX = 'onekey:bg:event:';
export const BACKGROUND_THREAD_BRIDGE_SEND_KEY_PREFIX = 'onekey:bg:bridge:';
export const WEBEMBED_BRIDGE_REQUEST_KEY_PREFIX = 'onekey:webembed:req:';
export const WEBEMBED_BRIDGE_RESPONSE_KEY_PREFIX = 'onekey:webembed:resp:';

export function buildBackgroundThreadRequestKey(callId: string) {
  return `${BACKGROUND_THREAD_REQUEST_KEY_PREFIX}${callId}`;
}

export function buildBackgroundThreadResponseKey(callId: string) {
  return `${BACKGROUND_THREAD_RESPONSE_KEY_PREFIX}${callId}`;
}

export function buildBackgroundThreadJotaiStateKey(callId: string) {
  return `${BACKGROUND_THREAD_JOTAI_STATE_KEY_PREFIX}${callId}`;
}

export function buildBackgroundThreadAppEventKey(callId: string) {
  return `${BACKGROUND_THREAD_APP_EVENT_KEY_PREFIX}${callId}`;
}

export function buildBackgroundThreadBridgeSendKey(callId: string) {
  return `${BACKGROUND_THREAD_BRIDGE_SEND_KEY_PREFIX}${callId}`;
}

export function buildWebEmbedBridgeRequestKey(callId: string) {
  return `${WEBEMBED_BRIDGE_REQUEST_KEY_PREFIX}${callId}`;
}

export function buildWebEmbedBridgeResponseKey(callId: string) {
  return `${WEBEMBED_BRIDGE_RESPONSE_KEY_PREFIX}${callId}`;
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
  payload: IBackgroundThreadRequest,
) {
  return JSON.stringify(payload);
}

export function parseBackgroundThreadRequest(
  value: string | number | boolean | undefined,
): IBackgroundThreadRequest | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const payload = JSON.parse(value) as Partial<IBackgroundThreadRequest>;
    switch (payload.type) {
      case 'service-call':
        if (
          typeof payload.method !== 'string' ||
          !Array.isArray(payload.params) ||
          typeof payload.sync !== 'boolean'
        ) {
          return undefined;
        }
        return payload as IBackgroundThreadServiceCallRequest;
      case 'bridge-call':
        if (!payload.payload || typeof payload.payload !== 'object') {
          return undefined;
        }
        return payload as IBackgroundThreadBridgeCallRequest;
      case 'bridge-connect':
        if (
          (payload.channel !== 'dapp' && payload.channel !== 'webEmbed') ||
          typeof payload.connected !== 'boolean' ||
          typeof payload.globalOnMessageEnabled !== 'boolean' ||
          (payload.origin !== undefined && typeof payload.origin !== 'string')
        ) {
          return undefined;
        }
        return payload as IBackgroundThreadBridgeConnectRequest;
      case 'app-event':
        if (typeof payload.eventName !== 'string') {
          return undefined;
        }
        return payload as IBackgroundThreadAppEventRequest;
      default:
        return undefined;
    }
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
    const payload = JSON.parse(
      value,
    ) as Partial<IBackgroundThreadResponsePayload>;
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

export function serializeBackgroundThreadJotaiStateBroadcastPayload(
  payload: IBackgroundThreadJotaiStateBroadcastPayload,
) {
  return JSON.stringify(payload);
}

export function parseBackgroundThreadJotaiStateBroadcastPayload(
  value: string | number | boolean | undefined,
): IBackgroundThreadJotaiStateBroadcastPayload | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      value,
    ) as Partial<IBackgroundThreadJotaiStateBroadcastPayload>;
    if (typeof payload.name !== 'string') {
      return undefined;
    }

    return payload as IBackgroundThreadJotaiStateBroadcastPayload;
  } catch {
    return undefined;
  }
}

export function serializeBackgroundThreadAppEventBroadcastPayload(
  payload: IBackgroundThreadAppEventBroadcastPayload,
) {
  return JSON.stringify(payload);
}

export function parseBackgroundThreadAppEventBroadcastPayload(
  value: string | number | boolean | undefined,
): IBackgroundThreadAppEventBroadcastPayload | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      value,
    ) as Partial<IBackgroundThreadAppEventBroadcastPayload>;
    if (typeof payload.eventName !== 'string') {
      return undefined;
    }

    return payload as IBackgroundThreadAppEventBroadcastPayload;
  } catch {
    return undefined;
  }
}

export function serializeBackgroundThreadBridgeSendPayload(
  payload: IBackgroundThreadBridgeSendPayload,
) {
  return JSON.stringify(payload);
}

export function parseBackgroundThreadBridgeSendPayload(
  value: string | number | boolean | undefined,
): IBackgroundThreadBridgeSendPayload | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      value,
    ) as Partial<IBackgroundThreadBridgeSendPayload>;
    if (
      (payload.channel !== 'dapp' && payload.channel !== 'webEmbed') ||
      typeof payload.scope !== 'string'
    ) {
      return undefined;
    }

    return payload as IBackgroundThreadBridgeSendPayload;
  } catch {
    return undefined;
  }
}
