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
  getUrlHostForLog,
  isStructuralOnramperError,
} from '@onekeyhq/shared/src/modules3rdParty/onramper';
import type {
  IOnramperButtonStyle,
  IOnramperClient,
  IOnramperEvent,
  IOnramperQuote,
  IOnramperSession,
} from '@onekeyhq/shared/src/modules3rdParty/onramper';

import { getOnramperErrorMessage } from './onramperErrorCopy';
import { EBuyActionState } from './types';

const DEBOUNCE_MS = 400;

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
  buttonStyle: IOnramperButtonStyle;
  // Surface that launched the buy page — rides on every funnel event.
  entryFrom?: string;
  onCompleted: (event: IOnramperEvent) => void;
};

type IResult = {
  actionState: EBuyActionState;
  nativeButton: ReactNode;
  quote: IOnramperQuote | undefined;
  isMock: boolean;
  errorMessage: string | undefined;
  // SDK error code behind errorMessage — lets the page route amount-level
  // failures back to the input screen instead of a generic retry.
  errorCode: string | undefined;
  payMock: () => void;
  // User-pressed Retry (logged as a funnel signal).
  retry: () => void;
  // Silent re-quote for flow-driven refreshes (e.g. leaving review).
  refreshQuote: () => void;
  // Clears the stored OnramperID login (OIDC tokens); the next checkout
  // re-runs email + phone verification. Exposed for the header sign-out
  // button.
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
  const [ready, setReady] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

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

  const createClient = useCallback(
    () =>
      createOnramperClient({
        // Real config on device (clientId from Onramper); the mock ignores it.
        ...getOnramperConfig(),
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
  // Sticky init failure (session mint / client.initialize): `ready` never
  // becomes true afterwards, so the quote loop and refreshQuote must keep the
  // WebFallback state instead of overwriting it with Preparing.
  const initFailedRef = useRef(false);

  // Keep callbacks fresh without re-subscribing the event listeners.
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

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

  // Shared failure policy for the SDK's `failed` event and the quote loop's
  // thrown rejection: structural → web fallback, everything else retryable.
  // Logging is the caller's job — the two paths emit different events.
  const applyFailure = useCallback(
    (event: IOnramperEvent) => {
      if (
        isStructuralOnramperError({
          code: event.errorCode,
          message: event.message,
        })
      ) {
        goWebFallback({ code: event.errorCode, message: event.message });
      } else {
        setErrorMessage(
          getOnramperErrorMessage({
            code: event.errorCode,
            message: event.message,
            info: event.info,
          }),
        );
        setErrorCode(event.errorCode);
        setActionState(EBuyActionState.RetryableError);
      }
    },
    [goWebFallback],
  );

  const handleCheckoutFailed = useCallback(
    (event: IOnramperEvent) => {
      // The failure belongs to the checkout mounted by quote #quoteSeq. Once a
      // newer quote request exists (amount / address edit, review exit) that
      // checkout is abandoned: log the event, but don't let it replace the
      // fresh quote's state with an unrelated retry error.
      const stale = quoteSeqRef.current !== reqSeqRef.current;
      defaultLogger.fiatCrypto.onramper.checkoutFailed({
        ...getLogContext(),
        ...getOnramperErrorFieldsForLog({
          code: event.errorCode,
          message: event.message,
          info: event.info,
        }),
        amount: amountRef.current,
        ramp: quoteRef.current?.ramp,
        checkoutId: event.checkoutId,
        transactionId: event.transactionId,
        stale,
      });
      if (stale) {
        return;
      }
      applyFailure(event);
    },
    [applyFailure, getLogContext],
  );
  const handleCheckoutFailedRef = useRef(handleCheckoutFailed);
  handleCheckoutFailedRef.current = handleCheckoutFailed;

  const handleCheckoutCompleted = useCallback(
    (event: IOnramperEvent) => {
      defaultLogger.fiatCrypto.onramper.checkoutCompleted({
        ...getLogContext(),
        amount: amountRef.current,
        ramp: quoteRef.current?.ramp,
        checkoutId: event.checkoutId,
        transactionId: event.transactionId,
      });
      onCompletedRef.current(event);
    },
    [getLogContext],
  );
  const handleCheckoutCompletedRef = useRef(handleCheckoutCompleted);
  handleCheckoutCompletedRef.current = handleCheckoutCompleted;

  // Every other SDK checkout event is diagnostics only: logged, never acted on.
  const handleSdkEvent = useCallback(
    (event: IOnramperEvent) => {
      if (!event.type) {
        return;
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
    [getLogContext],
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
    initFailedRef.current = false;
    let cancelled = false;
    const removeListeners = [
      ...ONRAMPER_EVENT_NAMES.map((name) =>
        client.addEventListener(name, (event) => {
          if (name === 'completed') {
            handleCheckoutCompletedRef.current(event);
          } else if (name === 'failed') {
            handleCheckoutFailedRef.current(event);
          } else {
            handleSdkEventRef.current(event);
          }
        }),
      ),
      client.addStateListener((state) => {
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
          defaultLogger.fiatCrypto.onramper.sessionMintFailed({
            ...getLogContext(),
            durationMs: Date.now() - mintStartedAt,
            errorMessage: getErrorMessageForLog(error),
          });
          initFailedRef.current = true;
          goWebFallback({ code: 'sessionMintFailed' });
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
      });
      const initStartedAt = Date.now();
      try {
        await client.initialize(session);
      } catch (error) {
        if (!cancelled) {
          const err = error as { code?: string; message?: string };
          defaultLogger.fiatCrypto.onramper.clientInitFailed({
            ...getLogContext(),
            durationMs: Date.now() - initStartedAt,
            ...getOnramperErrorFieldsForLog({
              code: err?.code,
              message: err?.message,
            }),
          });
          initFailedRef.current = true;
          goWebFallback({ code: err?.code ?? 'clientInitFailed' });
        }
        return;
      }
      if (!cancelled) {
        defaultLogger.fiatCrypto.onramper.clientInitialized({
          ...getLogContext(),
          durationMs: Date.now() - initStartedAt,
        });
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
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
  }, []);

  // Debounced checkout loop: re-quote on amount/token change; keep the old button
  // mounted under a mask (S3) and swap in a single commit; drop stale responses.
  useEffect(() => {
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
    const provider = onlyOnramps?.[0];
    const timer = setTimeout(() => {
      const client = clientRef.current;
      if (!client) {
        return;
      }
      defaultLogger.fiatCrypto.onramper.quoteRequested({
        ...getLogContext(),
        seq,
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
            buttonStyle,
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
          };
          defaultLogger.fiatCrypto.onramper.quoteFailed({
            ...getLogContext(),
            ...getOnramperErrorFieldsForLog({
              code: err?.code,
              message: err?.message,
              info: err?.info,
            }),
            seq,
            durationMs,
            amount,
            provider,
          });
          // Same classification policy as the SDK's `failed` event —
          // structural → web fallback, everything else retryable.
          applyFailure({
            errorCode: err?.code,
            message: err?.message,
            info: err?.info,
          });
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
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
    buttonStyle,
    retryNonce,
    applyFailure,
    getLogContext,
  ]);

  const payMock = useCallback(() => {
    handleCheckoutCompletedRef.current({
      type: 'completed',
      checkoutId: 'mock-checkout',
      transactionId: 'mock-transaction',
    });
  }, []);

  // Re-quote after a failure or a review exit. `reason` only feeds the log:
  // a user-pressed Retry is a funnel signal, an exit-driven re-quote is not.
  const refreshQuote = useCallback(() => {
    // Drop the previous quote's data and button up front: the button handle is
    // single-consume (remounting the old element renders blank) and a fast
    // exit-review → re-enter must show loading states, not the prior quote's
    // figures, until the fresh quote lands.
    quoteRef.current = undefined;
    setQuote(undefined);
    setNativeButton(null);
    hasButtonRef.current = false;
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

  const retry = useCallback(() => {
    defaultLogger.fiatCrypto.onramper.retryPressed({
      ...getLogContext(),
      errorCode: errorCodeRef.current,
    });
    refreshQuote();
  }, [getLogContext, refreshQuote]);

  const signOut = useCallback(async () => {
    defaultLogger.fiatCrypto.onramper.signOutPressed(getLogContext());
    try {
      await clientRef.current?.signOut();
    } catch (error) {
      defaultLogger.fiatCrypto.onramper.signOutFailed({
        ...getLogContext(),
        errorMessage: getErrorMessageForLog(error),
      });
      throw error;
    }
  }, [getLogContext]);

  return {
    actionState,
    nativeButton,
    quote,
    isMock,
    errorMessage,
    errorCode,
    payMock,
    retry,
    refreshQuote,
    signOut,
    getLogContext,
  };
}
