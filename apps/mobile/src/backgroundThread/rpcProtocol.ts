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

/**
 * Batched payload for jotai state broadcasts. Coalesces multiple atom writes
 * into a single SharedRPC slot to reduce main JS thread task pressure during
 * cascade bursts (e.g. when a slow service response triggers dozens of
 * downstream setAtomValue calls in the same microtask).
 *
 * Items are pre-deduplicated by name on the bg side (last value wins) and
 * iteration order matches first-insertion order — see
 * jotaiBgSync.flushBroadcastMicroBatch.
 */
export type IBackgroundThreadJotaiStateBroadcastBatchPayload = {
  items: Array<IBackgroundThreadJotaiStateBroadcastPayload>;
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
  payload?: unknown;
};

export type IBackgroundThreadResponsePayload = {
  ok: boolean;
  result?: unknown;
  error?: IBackgroundThreadResponseErrorPayload;
};

export const BACKGROUND_THREAD_REQUEST_KEY_PREFIX = 'onekey:bg:req:';
export const BACKGROUND_THREAD_RESPONSE_KEY_PREFIX = 'onekey:bg:res:';
export const BACKGROUND_THREAD_JOTAI_STATE_KEY_PREFIX = 'onekey:bg:jotai:';
export const BACKGROUND_THREAD_JOTAI_STATE_BATCH_KEY_PREFIX =
  'onekey:bg:jotai-batch:';
export const BACKGROUND_THREAD_APP_EVENT_KEY_PREFIX = 'onekey:bg:event:';
export const BACKGROUND_THREAD_BRIDGE_SEND_KEY_PREFIX = 'onekey:bg:bridge:';
export const WEBEMBED_BRIDGE_REQUEST_KEY_PREFIX = 'onekey:webembed:req:';
export const WEBEMBED_BRIDGE_RESPONSE_KEY_PREFIX = 'onekey:webembed:resp:';

// Static (single-slot) key the main runtime writes once on observer install
// to advertise which optional wire protocols it understands. The bg runtime
// reads / observes this slot and only switches to opt-in protocols (jotai
// batch broadcast etc.) after the matching capability bit is set, so a
// partial OTA / split-runtime mismatch can't silently drop batched updates.
// SharedStore key holding main's latched capability advertisement (+ doubling
// as the "main is up" liveness signal). Read synchronously by bg via
// `sharedStore.get`.
export const BACKGROUND_THREAD_MAIN_CAPABILITIES_KEY = 'onekey:bg:main-caps';
// SharedRPC content-less wake ping fired after main updates its latched
// capabilities in SharedStore (SharedStore has no notify). Edge-wakes bg to
// re-read the capabilities key. Value is irrelevant.
export const BACKGROUND_THREAD_MAIN_CAPABILITIES_WAKE_KEY =
  'onekey:bg:main-caps-wake';

export type IBackgroundThreadMainCapabilitiesPayload = {
  jotaiStateBatch?: boolean;
};

export function serializeBackgroundThreadMainCapabilitiesPayload(
  payload: IBackgroundThreadMainCapabilitiesPayload,
) {
  return JSON.stringify(payload);
}

export function parseBackgroundThreadMainCapabilitiesPayload(
  value: string | number | boolean | undefined,
): IBackgroundThreadMainCapabilitiesPayload | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      value,
    ) as Partial<IBackgroundThreadMainCapabilitiesPayload>;
    if (typeof payload !== 'object' || payload === null) {
      return undefined;
    }
    return payload as IBackgroundThreadMainCapabilitiesPayload;
  } catch {
    return undefined;
  }
}

export function buildBackgroundThreadRequestKey(callId: string) {
  return `${BACKGROUND_THREAD_REQUEST_KEY_PREFIX}${callId}`;
}

export function buildBackgroundThreadResponseKey(callId: string) {
  return `${BACKGROUND_THREAD_RESPONSE_KEY_PREFIX}${callId}`;
}

export function buildBackgroundThreadJotaiStateKey(callId: string) {
  return `${BACKGROUND_THREAD_JOTAI_STATE_KEY_PREFIX}${callId}`;
}

export function buildBackgroundThreadJotaiStateBatchKey(callId: string) {
  return `${BACKGROUND_THREAD_JOTAI_STATE_BATCH_KEY_PREFIX}${callId}`;
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

export function serializeBackgroundThreadJotaiStateBroadcastBatchPayload(
  payload: IBackgroundThreadJotaiStateBroadcastBatchPayload,
) {
  return JSON.stringify(payload);
}

export function parseBackgroundThreadJotaiStateBroadcastBatchPayload(
  value: string | number | boolean | undefined,
): IBackgroundThreadJotaiStateBroadcastBatchPayload | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      value,
    ) as Partial<IBackgroundThreadJotaiStateBroadcastBatchPayload>;
    if (!Array.isArray(payload.items)) {
      return undefined;
    }
    // Each item must carry a string `name`; payload is opaque.
    for (const item of payload.items) {
      if (!item || typeof (item as { name?: unknown }).name !== 'string') {
        return undefined;
      }
    }
    return payload as IBackgroundThreadJotaiStateBroadcastBatchPayload;
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
