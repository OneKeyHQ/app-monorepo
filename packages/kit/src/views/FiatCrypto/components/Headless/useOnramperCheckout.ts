import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  createOnramperClient,
  getOnramperConfig,
  isStructuralOnramperError,
} from '@onekeyhq/shared/src/modules3rdParty/onramper';
import type {
  IOnramperButtonStyle,
  IOnramperClient,
  IOnramperEvent,
  IOnramperQuote,
} from '@onekeyhq/shared/src/modules3rdParty/onramper';

import { getOnramperErrorMessage } from './onramperErrorCopy';
import { EBuyActionState } from './types';

const DEBOUNCE_MS = 400;

type IParams = {
  amount: number; // parsed fiat amount (0 when empty/invalid)
  isAmountValid: boolean;
  source: string; // fiat code, e.g. 'usd'
  destination: string; // crypto code, e.g. 'sol'
  network: string; // onramper network code
  address: string | undefined;
  // ISO country code (lowercase); omit to let Onramper geo-detect by IP.
  country?: string;
  // Pin routing to these provider slugs; omit for Onramper's best choice.
  // Must be reference-stable (useMemo) — it is a debounce-effect dependency.
  onlyOnramps?: string[];
  buttonStyle: IOnramperButtonStyle;
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
  retry: () => void;
  // Clears the stored OnramperID login (OIDC tokens); the next checkout
  // re-runs email + phone verification. Exposed for the dev/debug button.
  signOut: () => Promise<void>;
};

// Owns the Headless checkout lifecycle: session mint + client init, the debounced
// getCheckoutRequirements loop, the no-flicker button swap, event wiring, and the
// funnel analytics.
export function useOnramperCheckout({
  amount,
  isAmountValid,
  source,
  destination,
  network,
  address,
  country,
  onlyOnramps,
  buttonStyle,
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

  const createClient = useCallback(
    () =>
      createOnramperClient({
        // Real config on device (clientId from Onramper); the mock ignores it.
        ...getOnramperConfig(),
        onSessionExpired: () =>
          backgroundApiProxy.serviceFiatCrypto.fetchOnramperSession(),
      }),
    [],
  );
  // Lazily create a single client for the lifetime of the page.
  const clientRef = useRef<IOnramperClient | null>(null);
  if (clientRef.current === null) {
    clientRef.current = createClient();
  }
  const isMock = clientRef.current?.isMock ?? false;

  const reqSeqRef = useRef(0);
  const hasButtonRef = useRef(false);
  const quoteLoggedRef = useRef(false);

  // Reference-stable logging context so the (dep-free) event callbacks can read
  // the current token without re-subscribing.
  const logCtxRef = useRef({
    networkId: network,
    tokenSymbol: destination.toUpperCase(),
  });
  logCtxRef.current = {
    networkId: network,
    tokenSymbol: destination.toUpperCase(),
  };

  // Keep callbacks fresh without re-subscribing the event listeners.
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  const goWebFallback = useCallback((code?: string) => {
    defaultLogger.fiatCrypto.onramper.webFallbackShown({
      ...logCtxRef.current,
      errorCode: code,
    });
    setActionState(EBuyActionState.WebFallback);
  }, []);

  const handleFailed = useCallback(
    (event: IOnramperEvent) => {
      defaultLogger.fiatCrypto.onramper.checkoutFailed({
        ...logCtxRef.current,
        errorCode: event.errorCode,
        checkoutId: event.checkoutId,
      });
      if (
        isStructuralOnramperError({
          code: event.errorCode,
          message: event.message,
        })
      ) {
        goWebFallback(event.errorCode);
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
  const handleFailedRef = useRef(handleFailed);
  handleFailedRef.current = handleFailed;

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
    let cancelled = false;
    const removeListeners = [
      client.addEventListener('completed', (event) => {
        defaultLogger.fiatCrypto.onramper.checkoutCompleted({
          ...logCtxRef.current,
          checkoutId: event.checkoutId,
        });
        onCompletedRef.current(event);
      }),
      client.addEventListener('failed', (event) =>
        handleFailedRef.current(event),
      ),
    ];
    void (async () => {
      try {
        const session = client.isMock
          ? { sessionId: 'mock', sessionToken: 'mock' }
          : await backgroundApiProxy.serviceFiatCrypto.fetchOnramperSession();
        if (cancelled) {
          return;
        }
        await client.initialize(session);
        if (!cancelled) {
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          goWebFallback('sessionMintFailed');
        }
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
        } catch {
          // Best-effort teardown; the instance is already unreachable.
        }
      }, 400);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced checkout loop: re-quote on amount/token change; keep the old button
  // mounted under a mask (S3) and swap in a single commit; drop stale responses.
  useEffect(() => {
    if (!ready) {
      setActionState(EBuyActionState.Preparing);
      return undefined;
    }
    if (!isAmountValid || amount <= 0) {
      setActionState(EBuyActionState.InvalidAmount);
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
    const timer = setTimeout(() => {
      const client = clientRef.current;
      if (!client) {
        return;
      }
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
          if (cancelled || seq !== reqSeqRef.current) {
            return;
          }
          setQuote(result.quote);
          setNativeButton(result.button);
          hasButtonRef.current = true;
          if (!quoteLoggedRef.current) {
            quoteLoggedRef.current = true;
            defaultLogger.fiatCrypto.onramper.quoteReceived({
              ...logCtxRef.current,
              amount,
              quoteId: result.quote.quoteId,
            });
          }
          setActionState(EBuyActionState.Ready);
        } catch (error) {
          if (cancelled || seq !== reqSeqRef.current) {
            return;
          }
          const err = error as {
            code?: string;
            message?: string;
            info?: Record<string, unknown>;
          };
          defaultLogger.fiatCrypto.onramper.checkoutFailed({
            ...logCtxRef.current,
            errorCode: err?.code,
          });
          if (isStructuralOnramperError(err)) {
            goWebFallback(err?.code);
          } else {
            setErrorMessage(getOnramperErrorMessage(err));
            setErrorCode(err?.code);
            setActionState(EBuyActionState.RetryableError);
          }
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
    source,
    destination,
    network,
    address,
    country,
    onlyOnramps,
    buttonStyle,
    retryNonce,
    goWebFallback,
  ]);

  const payMock = useCallback(() => {
    defaultLogger.fiatCrypto.onramper.checkoutCompleted({
      ...logCtxRef.current,
      checkoutId: 'mock-checkout',
    });
    onCompletedRef.current({ checkoutId: 'mock-checkout' });
  }, []);

  const retry = useCallback(() => {
    // Drop the previous quote's data and button up front: the button handle is
    // single-consume (remounting the old element renders blank) and a fast
    // exit-review → re-enter must show loading states, not the prior quote's
    // figures, until the fresh quote lands.
    setQuote(undefined);
    setNativeButton(null);
    hasButtonRef.current = false;
    // Enter Preparing in the SAME commit: the async reset()→re-quote path
    // updates actionState a few frames later, and in that gap "quote cleared
    // but still Ready" the estimate line would flash 0 before its skeleton.
    setActionState(EBuyActionState.Preparing);
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
        } catch {
          // A reset failure must not block the re-quote; the quote loop
          // surfaces its own error if the client is genuinely unusable.
        }
        setRetryNonce((n) => n + 1);
      })();
    }, 64);
  }, []);

  const signOut = useCallback(async () => {
    await clientRef.current?.signOut();
  }, []);

  return {
    actionState,
    nativeButton,
    quote,
    isMock,
    errorMessage,
    errorCode,
    payMock,
    retry,
    signOut,
  };
}
