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

// Mirrors the SDK's `OnramperErrorCode` union (1.1.0) — used to validate codes
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
  if (platformEnv.isDev) {
    // TEMPORARY(onramper-debug): dump the SDK state stream to learn where
    // `amount_limit` requirements surface (at quote time vs at button tap) —
    // decides whether min/max copy is possible pre-tap; remove before merge.
    client.addStateListener((state) => {
      console.log('[onramper-debug] state', JSON.stringify(state));
    });
  }
  return {
    isMock: false,
    initialize: (session) => {
      if (platformEnv.isDev) {
        // TEMPORARY(onramper-debug): staging-only session dump for debugging the
        // BFF invalid_grant rejection; remove before merge.
        console.log(
          '[onramper-debug] initialize session =',
          JSON.stringify(session),
        );
      }
      return client.initialize(session);
    },
    getCheckoutRequirements: async (request, buttonStyle) => {
      try {
        const res = await client.getCheckoutRequirements(request, buttonStyle);
        if (platformEnv.isDev) {
          // TEMPORARY(onramper-debug): log successful quotes — quoteId is what
          // Onramper support asks for when tracing an order server-side; the
          // error path below already logs failures. Remove before merge.
          console.log(
            '[onramper-debug] quote ok',
            JSON.stringify({
              quoteId: res.quote?.quoteId,
              ramp: res.quote?.ramp,
              payout: res.quote?.payout,
              // rate verified = payout/amount (crypto-per-fiat); fees logged
              // so each quote line carries the full spread-analysis inputs.
              rate: res.quote?.rate,
              networkFee: res.quote?.networkFee,
              transactionFee: res.quote?.transactionFee,
              // Unconfirmed semantics — suspected alternative provider slugs;
              // our provider-switch UI feeds on it.
              recommendations: res.quote?.recommendations,
            }),
          );
        }
        return { button: res.button as ReactNode, quote: res.quote };
      } catch (error) {
        const enriched = withRecoveredErrorCode(error);
        if (platformEnv.isDev) {
          // TEMPORARY(onramper-debug): surface the real SDK error code/info while
          // tuning the retryable-vs-structural classification; remove before merge.
          const e = enriched as {
            code?: string;
            message?: string;
            info?: unknown;
          };
          console.log(
            '[onramper-debug] quote error',
            JSON.stringify({
              code: e?.code,
              message: e?.message,
              info: e?.info,
            }),
          );
        }
        throw enriched;
      }
    },
    addEventListener: (
      name: IOnramperEventName,
      listener: IOnramperEventListener,
    ) =>
      client.addEventListener(name, (event: unknown) => {
        if (platformEnv.isDev) {
          // TEMPORARY(onramper-debug): dump raw SDK events (incl. error.info)
          // while debugging staging checkout failures; remove before merge.
          console.log('[onramper-debug] event', name, JSON.stringify(event));
        }
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
