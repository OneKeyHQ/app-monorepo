import type { ReactNode } from 'react';

import { OnramperClient } from '@onramper/onramper-react-native';

import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';

import type {
  ICreateOnramperClientParams,
  IOnramperClient,
  IOnramperConfig,
  IOnramperEvent,
  IOnramperEventListener,
  IOnramperEventName,
  IOnramperState,
  IOnramperStateListener,
} from './type';
import type {
  CheckoutEvent,
  EventName,
  OnramperState,
} from '@onramper/onramper-react-native';

// Onramper credentials. BOTH are required by the SDK's configure() — apiKey is
// the publishable key (the hosted widget embeds the same key in its URL, it is
// not the backend partner secret), clientId identifies the partner app.
// Staging and production use DIFFERENT pairs, so the pair is selected with the
// same isDev switch as `environment` — a production build can never ship the
// staging key by accident.
const STAGING_CREDENTIALS = {
  clientId: '01KJD2DBBGF9Q8G133QK2A3DC1',
  apiKey: 'pk_test_01KWHMBRP4ABPB5DE4EB0CHNC6',
};
// Production pair is injected at bundle time (OK-59538 forbids committing it
// in plaintext): CI appends ONRAMPER_CLIENT_ID / ONRAMPER_API_KEY from GitHub
// secrets to .env.expo (release-ios.yml → shared-env action) before the EAS
// upload; local production-profile builds read them from the git-ignored root
// .env. Both names must stay in envExposedToClient.js for the babel inline to
// happen. When unset, hasOnramperCredentials() keeps production builds on the
// web widget instead of crashing at client creation.
const PRODUCTION_CREDENTIALS = {
  clientId: process.env.ONRAMPER_CLIENT_ID ?? '',
  apiKey: process.env.ONRAMPER_API_KEY ?? '',
};

function getCredentials() {
  return platformEnv.isDev ? STAGING_CREDENTIALS : PRODUCTION_CREDENTIALS;
}

export function hasOnramperCredentials(): boolean {
  const credentials = getCredentials();
  return Boolean(credentials.apiKey && credentials.clientId);
}

export function getOnramperConfig(): IOnramperConfig {
  return {
    ...getCredentials(),
    // The SDK only knows 'development' | 'production'; any other string is
    // silently coerced to production on the Swift side, so map dev builds to
    // 'development' explicitly (our staging session tokens only work there).
    environment: platformEnv.isDev ? 'development' : 'production',
    theme: 'system',
  };
}

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
      };
    case 'providerError':
      return { type: e.type, transactionId, reason: e.reason };
    case 'stateChanged':
      // Delivered through addStateListener; never subscribed here.
      return { transactionId };
    default:
      // readyToCheckout / cancelled / providerReady / paymentAuthorized /
      // paymentProcessing / paymentCancelled carry no payload.
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

// Mirrors the SDK's `OnramperErrorCode` union (1.2.2) — used to validate codes
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
  'sessionExpirationHandlerFailed',
]);

// The Nitro bridge drops the structured payload on thrown rejections: JS
// receives a plain Error whose message is the Swift enum description, e.g.
// `quoteUnavailable(debugInfo: Optional("OnramperBackend-40003: …"))`, and the
// JS wrapper stamps it code 'unrecoverable' (verified on device 2026-07-15).
// Recover the real case name from the message prefix so error classification
// and user-facing copy stay correct on the thrown path (the parallel `failed`
// event keeps the structured code, but the quote loop consumes the throw).
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

// Adapts the real Onramper SDK client to IOnramperClient.
export function createRealOnramperClient(
  params: ICreateOnramperClientParams,
): IOnramperClient {
  if (!params.apiKey || !params.clientId) {
    throw new OneKeyLocalError(
      'Onramper credentials missing: fill ONRAMPER_API_KEY / ONRAMPER_CLIENT_ID in realClient.native.ts',
    );
  }
  const client = new OnramperClient({
    apiKey: params.apiKey,
    clientId: params.clientId,
    environment: params.environment,
    theme: params.theme ?? 'system',
    logLevel: platformEnv.isDev ? 'debug' : 'off',
    onSessionExpired: params.onSessionExpired,
  });
  return {
    isMock: false,
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
