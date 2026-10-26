import type { ReactNode } from 'react';

import { OnramperClient } from '@onramper/onramper-react-native';

import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';

import type {
  ICreateOnramperClientParams,
  IOnramperClient,
  IOnramperEvent,
  IOnramperEventListener,
  IOnramperEventName,
  IOnramperState,
  IOnramperStateListener,
} from './type';
import type {
  CheckoutEvent,
  EventName,
  OnramperLogLevel,
  OnramperState,
} from '@onramper/onramper-react-native';

// Flattens an SDK checkout event to the event-agnostic IOnramperEvent shape
// the kit layer consumes (the SDK nests per-variant data, e.g. the failure
// under `error` and the finalize payload under `response`). `transactionId`
// is read from the client per event, not once: the SDK wrapper mirrors
// `checkoutFinalized.response.onramperTransactionId` into
// `currentTransactionId` BEFORE fanning the event out, so it is already set
// when `completed` / a post-finalize `failed` arrives, and reset()/signOut()
// clear it again.
function toOnramperEvent(
  e: CheckoutEvent,
  transactionId: string | undefined,
): IOnramperEvent {
  switch (e.type) {
    case 'checkoutStarted':
      return { type: e.type, transactionId, intentId: e.intentId };
    case 'loginRequired':
      return {
        type: e.type,
        transactionId,
        requirementTypes: e.requirements.map((r) => r.type),
      };
    case 'requirementSatisfied':
      return {
        type: e.type,
        transactionId,
        requirementType: e.requirementType,
      };
    case 'checkoutFinalized':
      return {
        type: e.type,
        transactionId,
        headlessCheckoutId: e.response.headlessCheckoutId,
        renderType: e.response.headlessCheckoutData.renderType,
        paymentType: e.response.headlessCheckoutData.checkoutPaymentType,
        url: e.response.headlessCheckoutData.url,
      };
    case 'renderingStarted':
      return {
        type: e.type,
        transactionId,
        renderType: e.renderType,
        url: e.url,
      };
    case 'completed':
      return { type: e.type, transactionId, checkoutId: e.checkoutId };
    case 'failed':
      return {
        type: e.type,
        transactionId,
        errorCode: e.error.code,
        message: e.error.message,
        info: e.error.info,
        // SDK 1.3+: optional on the payload, so an older native SDK still
        // produces a valid event (the kit layer has its own copy table).
        userMessage: e.error.userMessage,
        supportCode: e.error.supportCode,
      };
    case 'providerError':
      return { type: e.type, transactionId, reason: e.reason };
    case 'stateChanged':
      // Delivered through addStateListener; never subscribed here.
      return { transactionId };
    default:
      // readyToCheckout / cancelled / providerReady / paymentAuthorized /
      // paymentProcessing / paymentPending / challengeStarted /
      // challengeCompleted / customerOnboardingRequired / paymentCancelled
      // carry no payload.
      return { type: e.type, transactionId };
  }
}

function toOnramperState(s: OnramperState): IOnramperState {
  switch (s.kind) {
    case 'requireLogin':
      return {
        kind: s.kind,
        requirementTypes: s.requirements.map((r) => r.type),
      };
    case 'rendering':
      return {
        kind: s.kind,
        renderType: s.renderType,
        paymentType: s.paymentType,
      };
    case 'failed':
      return {
        kind: s.kind,
        errorCode: s.error.code,
        message: s.error.message,
      };
    default:
      return { kind: s.kind };
  }
}

// Mirrors the SDK's `OnramperErrorCode` union (1.3.1) — used to validate codes
// recovered from degraded bridge errors below.
const KNOWN_ERROR_CODES = new Set([
  'notInitialized',
  'initializationFailed',
  'attestationFailed',
  'invalidStateTransition',
  'invalidState',
  'networkError',
  'decodingError',
  'timeout',
  'paymentFailed',
  'providerFailed',
  'applePayNotConfigured',
  'requirementNotSatisfied',
  'amountOutOfRange',
  'oidcFlowCancelled',
  'oidcTokenExchangeFailed',
  'oidcFlowFailed',
  'userTokenInvalid',
  'userTokenRefreshFailed',
  'webviewLoadFailed',
  'deepLinkFailed',
  'invalidRequest',
  'quoteUnavailable',
  'checkoutForbidden',
  'temporaryFailure',
  'unrecoverable',
  'configurationError',
  'deviceBlocked',
  'securityStorageFailed',
  'securityTrustFailed',
  'platformUnsupported',
  'intentInvalidated',
  'intentAlreadyConsumed',
  'clientAlreadyConfigured',
  'clientDestroyed',
  'sessionExpirationHandlerFailed',
]);

// Up to SDK 1.2.2 the Nitro bridge dropped the structured payload on thrown
// rejections: JS received a plain Error whose message was the Swift enum
// description, e.g. `quoteUnavailable(debugInfo: Optional("OnramperBackend-
// 40003: …"))`, and the JS wrapper stamped it code 'unrecoverable' (verified
// on device 2026-07-15). SDK 1.3.0 encodes rejections explicitly so the code
// survives; this recovery stays as a safety net for any path that still
// degrades (it only ever rewrites an 'unrecoverable' code).
function withRecoveredErrorCode(error: unknown): unknown {
  const e = error as { code?: string; message?: string };
  if (!e || typeof e !== 'object') {
    return error;
  }
  if (e.code && e.code !== 'unrecoverable') {
    return error;
  }
  const match = /^([a-z][a-zA-Z0-9]*)\s*(?:\(|$)/.exec(e.message ?? '');
  const recovered = match?.[1];
  if (recovered && KNOWN_ERROR_CODES.has(recovered)) {
    e.code = recovered;
  }
  return error;
}

// Native SDK version (SDK 1.3.1+ static getter). Guarded: an older native
// SDK has no getter and the read must never take the client down with it.
function readNativeSdkVersion(): string | undefined {
  try {
    const version: unknown = OnramperClient.sdkVersion;
    return typeof version === 'string' && version ? version : undefined;
  } catch {
    return undefined;
  }
}

// Native log level. The RN bridge (HybridOnramperNitro.swift) hands every
// record to the SDK's unified-log handler (`OnramperLog.systemHandler`,
// emitted `.public`) BEFORE relaying it to JS, so any level above `off`
// writes the raw record — provider message included — to the iOS system log
// (Console.app, system diagnostic bundles) where no JS-side sanitizing can reach it.
// Production therefore stays `off`; dev builds log at `debug` and also
// receive the records through `onLog`.
function getLogLevel(): OnramperLogLevel {
  return platformEnv.isDev ? 'debug' : 'off';
}

// Adapts the real Onramper SDK client to IOnramperClient.
export function createRealOnramperClient(
  params: ICreateOnramperClientParams,
): IOnramperClient {
  if (!params.apiKey || !params.clientId) {
    throw new OneKeyLocalError(
      'Onramper credentials missing: fill ONRAMPER_API_KEY / ONRAMPER_CLIENT_ID in realClient.native.ts',
    );
  }
  const { onLog } = params;
  const client = new OnramperClient({
    apiKey: params.apiKey,
    clientId: params.clientId,
    environment: params.environment,
    theme: params.theme ?? 'system',
    logLevel: getLogLevel(),
    // Only reached at a level above `off`, i.e. in dev builds. The SDK
    // swallows sink exceptions, but a throwing sink would still cost a
    // console.warn per record; the sink itself is expected not to throw.
    logHandler: onLog
      ? (record) =>
          onLog({
            timestamp: record.timestamp,
            level: record.level,
            category: record.category,
            event: record.event,
            context: record.context,
            message: record.message,
          })
      : undefined,
    onSessionExpired: params.onSessionExpired,
  });
  return {
    isMock: false,
    sdkVersion: readNativeSdkVersion(),
    initialize: (session) => client.initialize(session),
    getCheckoutRequirements: async (request, buttonStyle) => {
      try {
        const res = await client.getCheckoutRequirements(request, buttonStyle);
        return { button: res.button as ReactNode, quote: res.quote };
      } catch (error) {
        throw withRecoveredErrorCode(error);
      }
    },
    addEventListener: (
      name: IOnramperEventName,
      listener: IOnramperEventListener,
    ) =>
      client.addEventListener<EventName>(name, (event) =>
        listener(
          toOnramperEvent(event, client.currentTransactionId ?? undefined),
        ),
      ),
    addStateListener: (listener: IOnramperStateListener) =>
      client.addStateListener((state) => listener(toOnramperState(state))),
    reset: () => client.reset(),
    signOut: () => client.signOut(),
    destroy: () => client.destroy(),
  };
}
