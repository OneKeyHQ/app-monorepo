import {
  BACKGROUND_THREAD_APP_EVENT_KEY_PREFIX,
  BACKGROUND_THREAD_BRIDGE_SEND_KEY_PREFIX,
  BACKGROUND_THREAD_JOTAI_STATE_BATCH_KEY_PREFIX,
  BACKGROUND_THREAD_JOTAI_STATE_KEY_PREFIX,
  BACKGROUND_THREAD_RESPONSE_KEY_PREFIX,
  WEBEMBED_BRIDGE_REQUEST_KEY_PREFIX,
} from './rpcProtocol';
import { BACKGROUND_THREAD_READY_WAKE_KEY } from './runtimeReady';

/**
 * Pure routing layer for inbound cross-runtime messages.
 *
 * In value-inline mode the SharedRPC notify callback delivers BOTH the
 * `callId` and the payload `value` (no read-back from a slot map). This
 * router dispatches a `(callId, value)` pair to the matching handler purely
 * by key prefix, with no dependency on the RN runtime / native bridge, so the
 * routing contract can be unit-tested in isolation.
 */
// The inbound payload type mirrors the native SharedRPC `onWrite` callback's
// 2nd argument and the `parseBackgroundThreadXxx` input type. In practice every
// message payload is a JSON string, but the value-carrying primitive is the
// `bool | number | string` union, so we route the union through untouched.
export type IBackgroundMessageRouterValue = string | number | boolean;

export type IBackgroundMessageRouterHandlers = {
  onReadySignal: () => void;
  onResponse: (callId: string, value: IBackgroundMessageRouterValue) => void;
  onJotaiStateBatch: (
    callId: string,
    value: IBackgroundMessageRouterValue,
  ) => void;
  onJotaiState: (callId: string, value: IBackgroundMessageRouterValue) => void;
  onAppEvent: (callId: string, value: IBackgroundMessageRouterValue) => void;
  onBridgeSend: (callId: string, value: IBackgroundMessageRouterValue) => void;
  onWebEmbedRequest: (
    callId: string,
    value: IBackgroundMessageRouterValue,
  ) => void;
};

export function routeBackgroundMessage(
  handlers: IBackgroundMessageRouterHandlers,
  callId: string,
  value: IBackgroundMessageRouterValue,
): void {
  // Content-less wake ping: the readiness payload itself lives (latched) in
  // SharedStore; this ping only edge-wakes us to re-read it. Value ignored.
  if (callId === BACKGROUND_THREAD_READY_WAKE_KEY) {
    handlers.onReadySignal();
    return;
  }

  if (callId.startsWith(BACKGROUND_THREAD_RESPONSE_KEY_PREFIX)) {
    handlers.onResponse(callId, value);
    return;
  }

  // Batch prefix must be checked BEFORE the single-state prefix. The two are
  // disjoint today (`onekey:bg:jotai-batch:` does not start with
  // `onekey:bg:jotai:`), but preserving the original dispatcher's ordering
  // keeps the contract robust against any future prefix change.
  if (callId.startsWith(BACKGROUND_THREAD_JOTAI_STATE_BATCH_KEY_PREFIX)) {
    handlers.onJotaiStateBatch(callId, value);
    return;
  }

  if (callId.startsWith(BACKGROUND_THREAD_JOTAI_STATE_KEY_PREFIX)) {
    handlers.onJotaiState(callId, value);
    return;
  }

  if (callId.startsWith(BACKGROUND_THREAD_APP_EVENT_KEY_PREFIX)) {
    handlers.onAppEvent(callId, value);
    return;
  }

  if (callId.startsWith(BACKGROUND_THREAD_BRIDGE_SEND_KEY_PREFIX)) {
    handlers.onBridgeSend(callId, value);
    return;
  }

  // Final case. If this prefix doesn't match either, the message falls through
  // and is intentionally ignored — a typo or a future bg-side key with no router
  // entry drops silently; the unit test `ignores an unknown key prefix` pins
  // this contract.
  if (callId.startsWith(WEBEMBED_BRIDGE_REQUEST_KEY_PREFIX)) {
    handlers.onWebEmbedRequest(callId, value);
  }
}
