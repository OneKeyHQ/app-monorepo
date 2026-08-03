import type { ReactNode } from 'react';

import { OnramperClient } from '@onramper/onramper-react-native';

import { OneKeyLocalError } from '../../errors';
import platformEnv from '../../platformEnv';

import type {
  ICreateOnramperClientParams,
  IOnramperClient,
  IOnramperConfig,
  IOnramperEventListener,
  IOnramperEventName,
} from './type';

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
// TODO(onramper): fill once Onramper issues the production pair (post
// Coinbase KYB). While empty, hasOnramperCredentials() keeps production
// builds on the web widget instead of crashing at client creation.
const PRODUCTION_CREDENTIALS = {
  clientId: '',
  apiKey: '',
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

// SDK checkout events nest the failure under `error` ({ error: { code, message,
// info } }); flatten to the IOnramperEvent shape the kit layer consumes.
type ISdkEventPayload = {
  checkoutId?: string;
  error?: { code?: string; message?: string; info?: Record<string, unknown> };
};

// Mirrors the SDK's `OnramperErrorCode` union (1.1.1) — used to validate codes
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
      client.addEventListener(name, (event: unknown) => {
        const e = event as ISdkEventPayload;
        listener({
          checkoutId: e.checkoutId,
          errorCode: e.error?.code,
          message: e.error?.message,
          info: e.error?.info,
        });
      }),
    reset: () => client.reset(),
    signOut: () => client.signOut(),
    destroy: () => client.destroy(),
  };
}
