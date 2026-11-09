import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IOnramperLogContext } from '@onekeyhq/shared/src/logger/scopes/fiatCrypto/scenes/onramper';
import {
  ONRAMPER_EVENT_NAMES,
  createOnramperClient,
  getErrorMessageForLog,
  getOnramperConfig,
  getOnramperErrorFieldsForLog,
  getOnramperSignedInFromState,
  getUrlHostForLog,
  isSelfHealingOnramperError,
  isStructuralOnramperError,
  isUserCancelledOnramperError,
  sanitizeOnramperLogRecord,
} from '@onekeyhq/shared/src/modules3rdParty/onramper';
import type {
  IOnramperButtonStyle,
  IOnramperClient,
  IOnramperError,
  IOnramperEvent,
  IOnramperQuote,
  IOnramperSession,
} from '@onekeyhq/shared/src/modules3rdParty/onramper';
import { getHeadlessBuyAbandonReason } from '@onekeyhq/shared/src/modules3rdParty/onramper/orderStatus';
import {
  ONRAMPER_SLOW_HINT_MS,
  getOnramperInitRetryDelayMs,
  getOnramperQuoteRetryDelayMs,
} from '@onekeyhq/shared/src/modules3rdParty/onramper/retryPolicy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import type { IHeadlessBuyAbandonReason } from '@onekeyhq/shared/types/fiatCrypto';

import { getOnramperErrorMessage } from './onramperErrorCopy';
import { EBuyActionState } from './types';

const DEBOUNCE_MS = 400;

// The OnramperID login the SDK last reported on this install. The SDK only
// reveals it once a checkout is prepared (getOnramperSignedInFromState), so
// this is what the page goes by until then. Undefined when nothing was ever
// reported: a fresh install, or a login made on a build that did not record
// it — the Keychain may hold one either way.
// Stored as '1' / '0', not a boolean: on iOS/Android the main runtime reads
// settings from a snapshot the background runtime builds at cold start with
// getString first, and MMKV answers that with "" for a stored `false` — a
// remembered sign-out came back as "unknown" after every relaunch (same trap
// as the pay-zone height, BuyActionZone.tsx).
function readRememberedSignedIn(): boolean | undefined {
  const stored = appStorage.syncStorage.getString(
    EAppSyncStorageKeys.onekey_onramper_id_signed_in,
  );
  if (stored === '1' || stored === '0') {
    return stored === '1';
  }
  // Written as a boolean by earlier builds: only `true` survives the snapshot.
  return appStorage.syncStorage.getBoolean(
    EAppSyncStorageKeys.onekey_onramper_id_signed_in,
  );
}

async function rememberSignedIn(signedIn: boolean) {
  try {
    await appStorage.syncStorage.set(
      EAppSyncStorageKeys.onekey_onramper_id_signed_in,
      signedIn ? '1' : '0',
    );
  } catch {
    // Not remembered: the next prepared checkout reports the login again.
  }
}

type IParams = {
  amount: number; // parsed fiat amount (0 when empty/invalid)
  isAmountValid: boolean;
  source: string; // fiat code, e.g. 'usd'
  destination: string; // Onramper asset id, e.g. 'usdt_ethereum'
  // Display symbol for analytics; defaults to the destination when omitted.
  tokenSymbol?: string;
  network: string; // onramper network code
  address: string | undefined;
  // ISO country code (lowercase); omit to let Onramper geo-detect by IP.
  country?: string;
  // Pin routing to these provider slugs; omit for Onramper's best choice.
  // Must be reference-stable (useMemo) — it is a debounce-effect dependency.
  onlyOnramps?: string[];
  // Read when a quote is requested, never a reason to request one: a theme
  // flip (system appearance can switch on a schedule) must not re-quote under
  // a checkout that is already paying. The next quote picks the new style up.
  buttonStyle: IOnramperButtonStyle;
  // Surface that launched the buy page — rides on every funnel event.
  entryFrom?: string;
  // The checkout reached its paid outcome: `completed`, or (SDK 1.3+)
  // `paymentPending` — accepted but not settled, which the SDK ends on
  // INSTEAD of `completed`. Either way the order is submitted and the status
  // page tracks settlement by transactionId.
  onCompleted: (event: IOnramperEvent) => void;
  // Fired once per transaction id, on the FIRST SDK event that carries one
  // (checkoutFinalized on 1.2.x) — i.e. before Apple Pay. The page records
  // the order here so a kill mid-payment cannot lose it.
  onTransactionCreated?: (transactionId: string) => void;
  // paymentAuthorized: the user approved the Apple Pay sheet.
  onPaymentAuthorized?: (transactionId: string) => void;
  // cancelled / failed without a completed: the (hidden) order is dead —
  // except `providerFailed` (SDK 1.3+), where the payment outcome is unknown
  // and the service keeps the record for tracking, and `authorizationFailed`
  // (the provider's payment page said the authorization failed), where the
  // service shows the record as failed.
  onCheckoutAbandoned?: (
    transactionId: string,
    reason: IHeadlessBuyAbandonReason,
  ) => void;
};

type IResult = {
  actionState: EBuyActionState;
  nativeButton: ReactNode;
  quote: IOnramperQuote | undefined;
  isMock: boolean;
  errorMessage: string | undefined;
  // Error code behind errorMessage — lets the page route amount-level
  // failures back to the input screen instead of a generic retry. The SDK's
  // code, except for a failed payment authorization, which the SDK reports
  // as `providerFailed` and this hook reports as `paymentFailed`.
  errorCode: string | undefined;
  // Set while the failure on screen left the payment outcome unknown (SDK
  // `providerFailed` with no page reason settling it): the order to send the
  // user to instead of offering a one-tap retry that could pay twice.
  unknownOutcomeTransactionId: string | undefined;
  payMock: () => void;
  // User-pressed Retry (logged as a funnel signal).
  retry: () => void;
  // The web fallback on screen came from a failed init that another attempt
  // may fix (anything but a structural failure): the zone offers `retryInit`
  // next to the web widget.
  canRetryInit: boolean;
  // Mints a new session and initializes a fresh client, in place.
  retryInit: () => void;
  // A visible wait (init or quote, with an amount entered) has lasted long
  // enough that the page should say it is still working.
  isTakingLong: boolean;
  // Silent re-quote for flow-driven refreshes (e.g. leaving review).
  refreshQuote: () => void;
  // Whether to offer the sign-out action. Follows the OnramperID login as far
  // as the SDK has told us: remembered from the last visit, then corrected by
  // every prepared checkout, by a checkout that gets paid after a login made
  // through its button, and by signOut. While the login is unknown it is
  // offered only on a failure, where no prepared checkout is coming to report
  // it: a user who signed in on an earlier build must still be able to switch
  // accounts from there.
  canSignOut: boolean;
  // Clears the stored OnramperID login (OIDC tokens); the next checkout
  // re-runs email + phone verification. Also re-quotes, because the SDK
  // discards the checkout it had prepared. Exposed for the failure states'
  // "verify with a different email" action.
  signOut: () => Promise<void>;
  // Logging context (network / token / entry / elapsed) for page-level events
  // so they line up with the hook's own timeline.
  getLogContext: () => IOnramperLogContext;
};

// Owns the Headless checkout lifecycle: session mint + client init, the debounced
// getCheckoutRequirements loop, the no-flicker button swap, event wiring, and the
// funnel analytics.
export function useOnramperCheckout({
  amount,
  isAmountValid,
  source,
  destination,
  tokenSymbol,
  network,
  address,
  country,
  onlyOnramps,
  buttonStyle,
  entryFrom,
  onCompleted,
  onTransactionCreated,
  onPaymentAuthorized,
  onCheckoutAbandoned,
}: IParams): IResult {
  const [actionState, setActionState] = useState<EBuyActionState>(
    EBuyActionState.Preparing,
  );
  const [nativeButton, setNativeButton] = useState<ReactNode>(null);
  const [quote, setQuote] = useState<IOnramperQuote | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  // Transaction the failure on screen belongs to (checkout failures only).
  const [errorTransactionId, setErrorTransactionId] = useState<
    string | undefined
  >(undefined);
  const [ready, setReady] = useState(false);
  // Mirrors `ready` for the dep-free event callbacks.
  const readyRef = useRef(false);
  const [retryNonce, setRetryNonce] = useState(0);
  // Each value is one init attempt (session mint + initialize) on a client of
  // its own; bumped by the automatic retries and by retryInit.
  const [initNonce, setInitNonce] = useState(0);
  // 1-based attempt of the current init run, and when that run began. A run is
  // the first attempt plus its automatic retries.
  const initAttemptRef = useRef(1);
  const initRunStartedAtRef = useRef(Date.now());
  const [canRetryInit, setCanRetryInit] = useState(false);
  // Bumped per quote request for new inputs so the slow-wait clock restarts
  // with it (not by the first request after an init, see the quote loop).
  const [waitEpoch, setWaitEpoch] = useState(0);
  const [isTakingLong, setIsTakingLong] = useState(false);
  // Undefined while unknown (readRememberedSignedIn).
  const [isSignedIn, setIsSignedIn] = useState<boolean | undefined>(
    readRememberedSignedIn,
  );
  const isSignedInRef = useRef(isSignedIn);
  const markSignedIn = useCallback((signedIn: boolean) => {
    if (isSignedInRef.current === signedIn) {
      return;
    }
    isSignedInRef.current = signedIn;
    setIsSignedIn(signedIn);
    void rememberSignedIn(signedIn);
  }, []);

  // Reference-stable logging context so the (dep-free) event callbacks can read
  // the current token without re-subscribing. `elapsedMs` counts from the
  // first render of the page so every event can be placed on one timeline.
  const mountedAtRef = useRef(Date.now());
  const logTokenSymbol = (tokenSymbol ?? destination).toUpperCase();
  const logCtxRef = useRef({
    networkId: network,
    tokenSymbol: logTokenSymbol,
    entryFrom,
  });
  logCtxRef.current = {
    networkId: network,
    tokenSymbol: logTokenSymbol,
    entryFrom,
  };
  const getLogContext = useCallback(
    (): IOnramperLogContext => ({
      ...logCtxRef.current,
      elapsedMs: Date.now() - mountedAtRef.current,
    }),
    [],
  );

  // Latest quote / amount for event enrichment (checkoutCompleted/Failed fire
  // from dep-free listeners).
  const quoteRef = useRef<IOnramperQuote | undefined>(undefined);
  const amountRef = useRef(amount);
  amountRef.current = amount;
  const errorCodeRef = useRef<string | undefined>(undefined);
  errorCodeRef.current = errorCode;
  const buttonStyleRef = useRef(buttonStyle);
  buttonStyleRef.current = buttonStyle;

  const createClient = useCallback(
    () =>
      createOnramperClient({
        // Real config on device (clientId from Onramper); the mock ignores it.
        ...getOnramperConfig(),
        // SDK 1.3 structured log records → device log only. Production keeps
        // the native log level off (see realClient getLogLevel), so this
        // only fires in dev builds; even there only format-checked
        // identifier / code fields are persisted and the free-form message
        // stays dev-only, because dev device logs get exported too.
        onLog: (record) => {
          defaultLogger.fiatCrypto.onramper.sdkLog({
            ...getLogContext(),
            ...sanitizeOnramperLogRecord(record, {
              keepMessage: Boolean(platformEnv.isDev),
            }),
          });
        },
        onSessionExpired: async () => {
          defaultLogger.fiatCrypto.onramper.sessionRefreshRequested(
            getLogContext(),
          );
          const startedAt = Date.now();
          try {
            const session =
              await backgroundApiProxy.serviceFiatCrypto.fetchOnramperSession();
            defaultLogger.fiatCrypto.onramper.sessionRefreshed({
              ...getLogContext(),
              durationMs: Date.now() - startedAt,
              expiresAt: session.expiresAt,
            });
            return session;
          } catch (error) {
            defaultLogger.fiatCrypto.onramper.sessionRefreshFailed({
              ...getLogContext(),
              durationMs: Date.now() - startedAt,
              errorMessage: getErrorMessageForLog(error),
            });
            throw error;
          }
        },
      }),
    [getLogContext],
  );
  // Lazily create a single client for the lifetime of the page.
  const clientRef = useRef<IOnramperClient | null>(null);
  if (clientRef.current === null) {
    clientRef.current = createClient();
  }
  const isMock = clientRef.current?.isMock ?? false;

  const reqSeqRef = useRef(0);
  // Seq of the quote whose button is currently mounted — a `failed` event
  // belongs to that checkout, so it is only acted on while no newer request
  // has superseded it.
  const quoteSeqRef = useRef(0);
  const hasButtonRef = useRef(false);
  const quoteLoggedRef = useRef(false);
  // Init gave up (session mint / client.initialize, retries included):
  // `ready` stays false until retryInit, so the quote loop and refreshQuote
  // must keep the WebFallback state instead of overwriting it with Preparing.
  const initFailedRef = useRef(false);

  // Keep callbacks fresh without re-subscribing the event listeners.
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;
  const onTransactionCreatedRef = useRef(onTransactionCreated);
  onTransactionCreatedRef.current = onTransactionCreated;
  const onPaymentAuthorizedRef = useRef(onPaymentAuthorized);
  onPaymentAuthorizedRef.current = onPaymentAuthorized;
  const onCheckoutAbandonedRef = useRef(onCheckoutAbandoned);
  onCheckoutAbandonedRef.current = onCheckoutAbandoned;
  // Last transaction id announced through onTransactionCreated. Checked on
  // EVERY event rather than only checkoutFinalized so the order is recorded
  // even if a future SDK publishes the id on a different event.
  const createdTransactionIdRef = useRef<string | undefined>(undefined);
  // Reason of the last `providerError` and the transaction it belongs to. The
  // SDK publishes it right before the `failed` it causes, and it is the only
  // place the provider page's own event name survives.
  const providerErrorRef = useRef<
    { transactionId: string; reason: string } | undefined
  >(undefined);
  // Set from the moment an unknown-outcome failure is put on screen until the
  // user moves on (a retry, a review exit, a new quote request). Until then,
  // later failures of that checkout are logged but not shown: none of them
  // can settle whether the payment went through, so none may bring the
  // one-tap retry back or replace the copy that sends the user to the order.
  const unknownOutcomeShownRef = useRef(false);
  const noteTransactionId = useCallback((transactionId: string | undefined) => {
    if (transactionId && createdTransactionIdRef.current !== transactionId) {
      createdTransactionIdRef.current = transactionId;
      onTransactionCreatedRef.current?.(transactionId);
    }
  }, []);

  const goWebFallback = useCallback(
    (error?: { code?: string; message?: string }) => {
      defaultLogger.fiatCrypto.onramper.webFallbackShown({
        ...getLogContext(),
        errorCode: error?.code,
        errorMessage: getErrorMessageForLog(error),
      });
      setActionState(EBuyActionState.WebFallback);
    },
    [getLogContext],
  );

  // refreshQuote is declared further down; the failure policy below reaches it
  // through this ref.
  const refreshQuoteRef = useRef<() => void>(() => undefined);
  // Set once a self-healing failure has been answered quietly. One per visit:
  // a failure that comes back — before the fresh quote lands or on the next
  // checkout — shows its error and Retry instead of re-preparing on every tap.
  const selfHealedRef = useRef(false);

  // Failures the page answers by quietly preparing a fresh checkout (the
  // tapped one is spent either way): a closed OnramperID sign-in, and the
  // first expired / refused checkout of the visit — but only while it never
  // reached a transaction. Once one exists a payment may be under way, and
  // the failure stays on screen.
  const isQuietRecovery = useCallback((event: IOnramperEvent) => {
    const error = { code: event.errorCode, message: event.message };
    if (isUserCancelledOnramperError(error)) {
      return true;
    }
    return (
      isSelfHealingOnramperError(error) &&
      !event.transactionId &&
      !selfHealedRef.current
    );
  }, []);

  // Shared failure policy for the SDK's `failed` event and the quote loop's
  // thrown rejection: a quiet recovery re-prepares the checkout, structural
  // → web fallback, everything else retryable. Logging is the caller's job —
  // the two paths emit different events.
  const applyFailure = useCallback(
    (event: IOnramperEvent) => {
      const error = { code: event.errorCode, message: event.message };
      if (isQuietRecovery(event)) {
        if (isSelfHealingOnramperError(error)) {
          selfHealedRef.current = true;
        }
        refreshQuoteRef.current();
        return;
      }
      if (isStructuralOnramperError(error)) {
        // The web fallback says why the in-app purchase is off.
        setErrorMessage(
          getOnramperErrorMessage({
            code: event.errorCode,
            message: event.message,
            userMessage: event.userMessage,
            supportCode: event.supportCode,
          }),
        );
        setErrorCode(event.errorCode);
        goWebFallback(error);
      } else {
        setErrorMessage(
          getOnramperErrorMessage({
            code: event.errorCode,
            message: event.message,
            info: event.info,
            userMessage: event.userMessage,
            supportCode: event.supportCode,
          }),
        );
        setErrorCode(event.errorCode);
        setErrorTransactionId(event.transactionId);
        setActionState(EBuyActionState.RetryableError);
      }
    },
    [goWebFallback, isQuietRecovery],
  );

  const handleCheckoutFailed = useCallback(
    (event: IOnramperEvent) => {
      noteTransactionId(event.transactionId);
      // The page reason that led to this failure, if it is this transaction's.
      // Consumed here: a later failure is judged on its own.
      const providerError = providerErrorRef.current;
      providerErrorRef.current = undefined;
      const providerReason =
        providerError && providerError.transactionId === event.transactionId
          ? providerError.reason
          : undefined;
      const abandonReason = getHeadlessBuyAbandonReason({
        errorCode: event.errorCode,
        providerReason,
      });
      if (event.transactionId) {
        // Regardless of `stale` below: a failed checkout's hidden order is
        // dead either way (the service ignores already-submitted orders) —
        // unless the payment surface failed with the outcome unknown, which
        // the service treats as "possibly paid" and keeps, or the payment
        // authorization failed, which the service shows as a failed order.
        onCheckoutAbandonedRef.current?.(event.transactionId, abandonReason);
      }
      // The failure belongs to the checkout mounted by quote #quoteSeq. Once a
      // newer quote request exists (amount / address edit, review exit) that
      // checkout is abandoned: log the event, but don't let it replace the
      // fresh quote's state with an unrelated retry error. Before the client
      // is ready there is no checkout at all: the SDK also publishes `failed`
      // for a failed initialize (before or after the call rejects), and that
      // one is the init effect's to settle — retry or fallback. And while an
      // unknown payment outcome is on screen, a further failure of the same
      // checkout changes nothing the user should act on (see
      // unknownOutcomeShownRef).
      const stale =
        !readyRef.current ||
        quoteSeqRef.current !== reqSeqRef.current ||
        unknownOutcomeShownRef.current;
      const recoveredQuietly = !stale && isQuietRecovery(event);
      defaultLogger.fiatCrypto.onramper.checkoutFailed({
        ...getLogContext(),
        ...getOnramperErrorFieldsForLog({
          code: event.errorCode,
          message: event.message,
          info: event.info,
          supportCode: event.supportCode,
        }),
        amount: amountRef.current,
        ramp: quoteRef.current?.ramp,
        checkoutId: event.checkoutId,
        transactionId: event.transactionId,
        providerReason,
        stale,
        recoveredQuietly,
      });
      if (stale) {
        return;
      }
      // Set before the state update lands, so a second `failed` published in
      // the same tick is already held back.
      unknownOutcomeShownRef.current =
        abandonReason === 'providerFailed' && Boolean(event.transactionId);
      // A failed authorization is a definite payment failure, whatever code
      // the SDK filed it under: show the payment-failed copy and keep the
      // in-place retry instead of the "status unknown" handling.
      applyFailure(
        abandonReason === 'authorizationFailed'
          ? { ...event, errorCode: 'paymentFailed' }
          : event,
      );
    },
    [applyFailure, getLogContext, isQuietRecovery, noteTransactionId],
  );
  const handleCheckoutFailedRef = useRef(handleCheckoutFailed);
  handleCheckoutFailedRef.current = handleCheckoutFailed;

  // `completed`, or SDK 1.3's `paymentPending` (accepted, settlement pending,
  // no `completed` follows): both hand the order to the status page.
  const handleCheckoutCompleted = useCallback(
    (event: IOnramperEvent) => {
      noteTransactionId(event.transactionId);
      defaultLogger.fiatCrypto.onramper.checkoutCompleted({
        ...getLogContext(),
        outcome:
          event.type === 'paymentPending' ? 'paymentPending' : 'completed',
        amount: amountRef.current,
        ramp: quoteRef.current?.ramp,
        checkoutId: event.checkoutId,
        transactionId: event.transactionId,
      });
      onCompletedRef.current(event);
    },
    [getLogContext, noteTransactionId],
  );
  const handleCheckoutCompletedRef = useRef(handleCheckoutCompleted);
  handleCheckoutCompletedRef.current = handleCheckoutCompleted;

  // Every other SDK checkout event: logged, and acted on only where noted.
  const handleSdkEvent = useCallback(
    (event: IOnramperEvent) => {
      if (!event.type) {
        return;
      }
      noteTransactionId(event.transactionId);
      if (event.transactionId) {
        if (event.type === 'paymentAuthorized') {
          onPaymentAuthorizedRef.current?.(event.transactionId);
        } else if (event.type === 'cancelled') {
          onCheckoutAbandonedRef.current?.(event.transactionId, 'cancelled');
        } else if (event.type === 'providerError' && event.reason) {
          // Kept for the `failed` event that follows (see handleCheckoutFailed).
          providerErrorRef.current = {
            transactionId: event.transactionId,
            reason: event.reason,
          };
        }
      }
      defaultLogger.fiatCrypto.onramper.sdkCheckoutEvent({
        ...getLogContext(),
        event: event.type,
        intentId: event.intentId,
        requirementTypes: event.requirementTypes,
        requirementType: event.requirementType,
        headlessCheckoutId: event.headlessCheckoutId,
        transactionId: event.transactionId,
        renderType: event.renderType,
        paymentType: event.paymentType,
        urlHost: getUrlHostForLog(event.url),
        reason: event.reason,
      });
    },
    [getLogContext, noteTransactionId],
  );
  const handleSdkEventRef = useRef(handleSdkEvent);
  handleSdkEventRef.current = handleSdkEvent;

  // Init: mint session (skipped for the mock) → initialize → wire events.
  useEffect(() => {
    // Recreate when a previous cleanup destroyed the client: Fast Refresh (and
    // StrictMode) re-run this effect with refs preserved, and every native
    // call on the disposed instance throws ("NativeState is null").
    if (!clientRef.current) {
      clientRef.current = createClient();
    }
    const client = clientRef.current;
    setReady(false);
    readyRef.current = false;
    initFailedRef.current = false;
    let cancelled = false;
    const attempt = initAttemptRef.current;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const getRetryDelayMs = (error: IOnramperError) =>
      getOnramperInitRetryDelayMs({
        attempt,
        elapsedMs: Date.now() - initRunStartedAtRef.current,
        error,
      });
    // A failed attempt either waits for its retry — the page keeps showing
    // Preparing, and the next attempt starts over on a new client, which is
    // what leaving and re-entering the page did — or ends the run on the web
    // fallback.
    const settleInitFailure = (
      error: IOnramperError,
      retryInMs: number | undefined,
    ) => {
      if (retryInMs !== undefined) {
        retryTimer = setTimeout(() => {
          initAttemptRef.current = attempt + 1;
          setInitNonce((n) => n + 1);
        }, retryInMs);
        return;
      }
      initFailedRef.current = true;
      setCanRetryInit(!isStructuralOnramperError(error));
      setErrorMessage(getOnramperErrorMessage(error));
      setErrorCode(error.code);
      goWebFallback(error);
    };
    const removeListeners = [
      ...ONRAMPER_EVENT_NAMES.map((name) =>
        client.addEventListener(name, (event) => {
          if (name === 'completed' || name === 'paymentPending') {
            handleCheckoutCompletedRef.current(event);
          } else if (name === 'failed') {
            handleCheckoutFailedRef.current(event);
          } else {
            handleSdkEventRef.current(event);
          }
        }),
      ),
      client.addStateListener((state) => {
        const signedIn = getOnramperSignedInFromState(state);
        if (signedIn !== undefined) {
          markSignedIn(signedIn);
        }
        defaultLogger.fiatCrypto.onramper.sdkStateChanged({
          ...getLogContext(),
          state: state.kind,
          requirementTypes: state.requirementTypes,
          renderType: state.renderType,
          paymentType: state.paymentType,
          errorCode: state.errorCode,
          errorMessage: getErrorMessageForLog(
            state.message ? { message: state.message } : undefined,
          ),
        });
      }),
    ];
    void (async () => {
      const mintStartedAt = Date.now();
      let session: IOnramperSession;
      try {
        session = client.isMock
          ? { sessionId: 'mock', sessionToken: 'mock' }
          : await backgroundApiProxy.serviceFiatCrypto.fetchOnramperSession();
      } catch (error) {
        if (!cancelled) {
          const initError = {
            code: 'sessionMintFailed',
            message: getErrorMessageForLog(error),
          };
          const retryInMs = getRetryDelayMs(initError);
          defaultLogger.fiatCrypto.onramper.sessionMintFailed({
            ...getLogContext(),
            durationMs: Date.now() - mintStartedAt,
            errorMessage: initError.message,
            attempt,
            retryInMs,
          });
          settleInitFailure(initError, retryInMs);
        }
        return;
      }
      if (cancelled) {
        return;
      }
      defaultLogger.fiatCrypto.onramper.sessionMinted({
        ...getLogContext(),
        durationMs: Date.now() - mintStartedAt,
        expiresAt: session.expiresAt,
        attempt,
      });
      const initStartedAt = Date.now();
      try {
        await client.initialize(session);
      } catch (error) {
        if (!cancelled) {
          const err = error as IOnramperError | undefined;
          const initError = {
            code: err?.code ?? 'clientInitFailed',
            message: err?.message,
            userMessage: err?.userMessage,
            supportCode: err?.supportCode,
          };
          const retryInMs = getRetryDelayMs(initError);
          defaultLogger.fiatCrypto.onramper.clientInitFailed({
            ...getLogContext(),
            durationMs: Date.now() - initStartedAt,
            ...getOnramperErrorFieldsForLog({
              code: err?.code,
              message: err?.message,
              supportCode: err?.supportCode,
            }),
            attempt,
            retryInMs,
          });
          settleInitFailure(initError, retryInMs);
        }
        return;
      }
      if (!cancelled) {
        defaultLogger.fiatCrypto.onramper.clientInitialized({
          ...getLogContext(),
          durationMs: Date.now() - initStartedAt,
          sdkVersion: client.sdkVersion,
          attempt,
        });
        readyRef.current = true;
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      removeListeners.forEach((remove) => remove());
      // The disposed instance must not be reused — see the recreate guard above.
      clientRef.current = null;
      // Defer the native teardown out of the unmount/navigation-transition
      // window: dispose() cancels SDK tasks and releases the @MainActor client
      // from the JS thread, and doing that while the modal dismissal is
      // animating has produced intermittent hard freezes on close. By 400ms
      // the transition is over.
      setTimeout(() => {
        try {
          client.destroy();
        } catch (error) {
          // Best-effort teardown; the instance is already unreachable.
          defaultLogger.fiatCrypto.onramper.clientDestroyFailed({
            ...getLogContext(),
            errorMessage: getErrorMessageForLog(error),
          });
        }
      }, 400);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initNonce]);

  // Whether the quote loop's previous run already had a ready client.
  const quoteLoopWasReadyRef = useRef(false);

  // Debounced checkout loop: re-quote on amount/token change; keep the old button
  // mounted under a mask (S3) and swap in a single commit; drop stale responses.
  useEffect(() => {
    const wasReady = quoteLoopWasReadyRef.current;
    quoteLoopWasReadyRef.current = ready;
    // Any run of this loop moves the page on from the failure it was showing.
    unknownOutcomeShownRef.current = false;
    if (!ready) {
      // Init failed for good: keep the web fallback the init effect chose
      // (this effect re-runs on every amount / address edit).
      if (!initFailedRef.current) {
        setActionState(EBuyActionState.Preparing);
      }
      return undefined;
    }
    if (!isAmountValid || amount <= 0) {
      setActionState(EBuyActionState.InvalidAmount);
      return undefined;
    }
    // Never quote a real checkout against an empty destination address: a
    // completed payment would have nowhere to send the crypto. The entry gate
    // guarantees an accountId, so the async address lookup lands shortly and
    // re-fires this effect (address is a dep); until then hold Preparing.
    // The mock stays exempt — the Simulator/Gallery preview has no account.
    if (!isMock && !address) {
      defaultLogger.fiatCrypto.onramper.quoteBlockedNoAddress({
        ...getLogContext(),
        amount,
      });
      setActionState(EBuyActionState.Preparing);
      return undefined;
    }
    let cancelled = false;
    const seq = reqSeqRef.current + 1;
    reqSeqRef.current = seq;
    setActionState(
      hasButtonRef.current
        ? EBuyActionState.Refreshing
        : EBuyActionState.Preparing,
    );
    setErrorMessage(undefined);
    setErrorCode(undefined);
    setErrorTransactionId(undefined);
    // A request the inputs asked for restarts the slow-wait clock. The first
    // request after an init does not: it is the tail of the wait the user has
    // been watching since the page (or "Try again") started preparing.
    if (wasReady) {
      setWaitEpoch(seq);
    }
    const provider = onlyOnramps?.[0];
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    // `attempt` is 1 for the debounced request and 2 for its one automatic
    // retry (transient failures only, see getOnramperQuoteRetryDelayMs).
    const requestQuote = (attempt: number) => {
      const client = clientRef.current;
      if (!client) {
        return;
      }
      defaultLogger.fiatCrypto.onramper.quoteRequested({
        ...getLogContext(),
        seq,
        attempt,
        amount,
        source,
        destination,
        provider,
      });
      const startedAt = Date.now();
      void (async () => {
        try {
          const result = await client.getCheckoutRequirements(
            {
              source,
              destination,
              amount,
              type: 'buy',
              paymentMethod: 'applepay',
              ...(country ? { country } : {}),
              ...(onlyOnramps?.length ? { onlyOnramps } : {}),
              wallet: { network, address: address ?? '' },
            },
            buttonStyleRef.current,
          );
          const durationMs = Date.now() - startedAt;
          if (cancelled || seq !== reqSeqRef.current) {
            defaultLogger.fiatCrypto.onramper.quoteStale({
              ...getLogContext(),
              seq,
              outcome: 'success',
            });
            return;
          }
          quoteRef.current = result.quote;
          quoteSeqRef.current = seq;
          setQuote(result.quote);
          setNativeButton(result.button);
          hasButtonRef.current = true;
          defaultLogger.fiatCrypto.onramper.quoteResolved({
            ...getLogContext(),
            seq,
            attempt,
            durationMs,
            amount,
            quoteId: result.quote.quoteId,
            ramp: result.quote.ramp,
            payout: result.quote.payout,
            networkFee: result.quote.networkFee,
            transactionFee: result.quote.transactionFee,
            recommendations: result.quote.recommendations,
          });
          if (!quoteLoggedRef.current) {
            quoteLoggedRef.current = true;
            defaultLogger.fiatCrypto.onramper.quoteReceived({
              ...getLogContext(),
              amount,
              durationMs,
              quoteId: result.quote.quoteId,
              ramp: result.quote.ramp,
              payout: result.quote.payout,
              networkFee: result.quote.networkFee,
              transactionFee: result.quote.transactionFee,
            });
          }
          setActionState(EBuyActionState.Ready);
        } catch (error) {
          const durationMs = Date.now() - startedAt;
          if (cancelled || seq !== reqSeqRef.current) {
            defaultLogger.fiatCrypto.onramper.quoteStale({
              ...getLogContext(),
              seq,
              outcome: 'failure',
            });
            return;
          }
          const err = error as {
            code?: string;
            message?: string;
            info?: Record<string, unknown>;
            userMessage?: string;
            supportCode?: string;
          };
          const retryInMs = getOnramperQuoteRetryDelayMs({
            attempt,
            error: err,
          });
          defaultLogger.fiatCrypto.onramper.quoteFailed({
            ...getLogContext(),
            ...getOnramperErrorFieldsForLog({
              code: err?.code,
              message: err?.message,
              info: err?.info,
              supportCode: err?.supportCode,
            }),
            seq,
            attempt,
            retryInMs,
            durationMs,
            amount,
            provider,
          });
          if (retryInMs !== undefined) {
            // Ask again before showing anything: the state stays Preparing /
            // Refreshing, and a newer request drops the timer in the cleanup.
            // No reset() in between — a quote-stage failure leaves the SDK
            // able to prepare the next checkout (device-traced: `failed` →
            // `checkoutPreparing`), same as an amount edit after a failure.
            retryTimer = setTimeout(() => requestQuote(attempt + 1), retryInMs);
            return;
          }
          // The retained quote answered an EARLIER request (previous amount /
          // provider / address); this failure means no quote answers the
          // current one. Drop it so every quote-derived figure — hero
          // estimate, payout, fees, provider-rate pricing — disappears instead
          // of being re-priced against the new inputs (a $100 payout priced at
          // a $500 amount reads as a 5x rate). The mounted native button is
          // left alone: the zone covers it with Retry / web fallback, and
          // refreshQuote swaps it on the next attempt.
          quoteRef.current = undefined;
          setQuote(undefined);
          // Same classification policy as the SDK's `failed` event —
          // structural → web fallback, everything else retryable.
          applyFailure({
            errorCode: err?.code,
            message: err?.message,
            info: err?.info,
            userMessage: err?.userMessage,
            supportCode: err?.supportCode,
          });
        }
      })();
    };
    const timer = setTimeout(() => requestQuote(1), DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(retryTimer);
    };
  }, [
    ready,
    amount,
    isAmountValid,
    isMock,
    source,
    destination,
    network,
    address,
    country,
    onlyOnramps,
    retryNonce,
    applyFailure,
    getLogContext,
  ]);

  // The wait the user can see: an amount is entered and the init or the quote
  // behind it has not answered. Automatic retries keep the state Preparing,
  // and an init hands over to its first quote without leaving it, so those
  // count as one wait; a quote request for new inputs restarts the clock.
  const isWaiting =
    isAmountValid &&
    amount > 0 &&
    (actionState === EBuyActionState.Preparing ||
      actionState === EBuyActionState.Refreshing);
  useEffect(() => {
    setIsTakingLong(false);
    if (!isWaiting) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setIsTakingLong(true);
      defaultLogger.fiatCrypto.onramper.waitingHintShown({
        ...getLogContext(),
        stage: readyRef.current ? 'quote' : 'init',
      });
    }, ONRAMPER_SLOW_HINT_MS);
    return () => clearTimeout(timer);
  }, [isWaiting, waitEpoch, getLogContext]);

  // Starts a new init run from the web fallback an earlier run ended on.
  const retryInit = useCallback(() => {
    defaultLogger.fiatCrypto.onramper.initRetryPressed({
      ...getLogContext(),
      errorCode: errorCodeRef.current,
    });
    initAttemptRef.current = 1;
    initRunStartedAtRef.current = Date.now();
    initFailedRef.current = false;
    setCanRetryInit(false);
    setErrorMessage(undefined);
    setErrorCode(undefined);
    setActionState(EBuyActionState.Preparing);
    setInitNonce((n) => n + 1);
  }, [getLogContext]);

  const payMock = useCallback(() => {
    // Mirror the real event order: the id is known before "payment". The
    // `mock-` prefix tells the order service never to look it up.
    const transactionId = `mock-${Date.now()}`;
    noteTransactionId(transactionId);
    handleCheckoutCompletedRef.current({
      type: 'completed',
      checkoutId: 'mock-checkout',
      transactionId,
    });
  }, [noteTransactionId]);

  // Re-quote after a failure, a review exit or a sign-out. `reason` only
  // feeds the log: a user-pressed Retry is a funnel signal, an exit-driven
  // re-quote is not.
  const refreshQuote = useCallback(() => {
    // Drop the previous quote's data and button up front: the button handle is
    // single-consume (remounting the old element renders blank) and a fast
    // exit-review → re-enter must show loading states, not the prior quote's
    // figures, until the fresh quote lands.
    quoteRef.current = undefined;
    setQuote(undefined);
    setNativeButton(null);
    hasButtonRef.current = false;
    // Retire the spent checkout now, not when the deferred re-quote runs:
    // its later `failed` events are stale from here, so none can flash an
    // error over the fresh checkout or put a failure on screen that the
    // re-quote then wipes. A quote still in flight is dropped the same way.
    reqSeqRef.current += 1;
    // The user moved on from whatever failure was on screen.
    unknownOutcomeShownRef.current = false;
    // Enter Preparing in the SAME commit: the async reset()→re-quote path
    // updates actionState a few frames later, and in that gap "quote cleared
    // but still Ready" the estimate line would flash 0 before its skeleton.
    // After a sticky init failure there is nothing to re-quote against —
    // stay on the web fallback so the review screen keeps its exit.
    setActionState(
      initFailedRef.current
        ? EBuyActionState.WebFallback
        : EBuyActionState.Preparing,
    );
    // Defer reset() past the unmount frames. Dispatched synchronously it
    // reaches the SDK BEFORE React commits the review unmount (device-traced:
    // the idle/ready state events land ~1.5ms before the mode flip), and the
    // still-visible SwiftUI button reacts — its consent copy drops and the
    // button re-centers downward inside its hosting view — a visible jolt.
    // Two frames later the view is off screen and the re-layout is invisible.
    setTimeout(() => {
      void (async () => {
        // Per the SDK docs, a terminal `failed` checkout needs reset() before
        // starting another one (returns the state machine to `ready`);
        // harmless when the failure never left the quote stage. Official
        // example does the same between checkouts.
        try {
          await clientRef.current?.reset();
        } catch (error) {
          // A reset failure must not block the re-quote; the quote loop
          // surfaces its own error if the client is genuinely unusable.
          defaultLogger.fiatCrypto.onramper.resetFailed({
            ...getLogContext(),
            errorMessage: getErrorMessageForLog(error),
          });
        }
        setRetryNonce((n) => n + 1);
      })();
    }, 64);
  }, [getLogContext]);
  refreshQuoteRef.current = refreshQuote;

  const retry = useCallback(() => {
    defaultLogger.fiatCrypto.onramper.retryPressed({
      ...getLogContext(),
      errorCode: errorCodeRef.current,
    });
    refreshQuote();
  }, [getLogContext, refreshQuote]);

  const signOut = useCallback(async () => {
    defaultLogger.fiatCrypto.onramper.signOutPressed(getLogContext());
    // signOut() makes the SDK drop the checkout it prepared: the mounted
    // button stops responding, and a quote still in flight is invalidated the
    // moment the call is made (it rejects with `intentInvalidated`), even if
    // the sign-out then fails. Retire that quote here and prepare a new
    // checkout once the call has settled, either way.
    reqSeqRef.current += 1;
    try {
      await clientRef.current?.signOut();
      markSignedIn(false);
    } catch (error) {
      defaultLogger.fiatCrypto.onramper.signOutFailed({
        ...getLogContext(),
        errorMessage: getErrorMessageForLog(error),
      });
      throw error;
    } finally {
      refreshQuote();
    }
  }, [getLogContext, markSignedIn, refreshQuote]);

  // Unknown login: a sticky init failure or a failed first quote leaves the
  // page without a prepared checkout to report it, and signOut() works there
  // (it needs the configured client, not an initialized one).
  const canSignOut =
    isSignedIn ??
    (actionState === EBuyActionState.RetryableError ||
      actionState === EBuyActionState.WebFallback);

  return {
    actionState,
    nativeButton,
    quote,
    isMock,
    errorMessage,
    errorCode,
    // Tied to the failure being on screen: a retry or a review exit moves the
    // state on before the next quote clears the error fields.
    unknownOutcomeTransactionId:
      actionState === EBuyActionState.RetryableError &&
      errorCode === 'providerFailed'
        ? errorTransactionId
        : undefined,
    payMock,
    retry,
    canRetryInit: actionState === EBuyActionState.WebFallback && canRetryInit,
    retryInit,
    isTakingLong,
    refreshQuote,
    canSignOut,
    signOut,
    getLogContext,
  };
}
