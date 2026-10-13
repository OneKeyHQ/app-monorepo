import * as Linking from 'expo-linking';

import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/app/app';
// Already on the startup graph: the generic deep link entry, the only importer
// of this file, imports it statically. Its scopes are created on first use.
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IBinanceDepositReturnSource } from '@onekeyhq/shared/types/exchange';

import { isBinanceConnectDeepLink } from './binanceConnectDeepLink';

import type { IRegisterHandler } from './handler.type';

type IBinanceDepositReturnHandler = (
  url: string,
  source: IBinanceDepositReturnSource,
) => Promise<void>;

// The wait before the second, and last, attempt to load the return handler.
// A cold start can ask for its bundle segment before the runtime is ready to
// load one, which fails for a moment and then works.
//
// Two attempts and no more, the bound shared/src/lazyLoad keeps for the same
// reason: the segment loader allows a segment three retryable failures per
// process and then keeps it as failed for good. The self-test page depends on
// the same segment, so one attempt is left for opening it, where the
// foreground fallback can still pick the return up.
const RETURN_HANDLER_LOAD_RETRY_DELAYS_MS: readonly number[] = [600];
const RETURN_HANDLER_LOAD_FAILED_REASON = 'handler_load_failed';

function waitFor(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

// The round of attempts that is running, if any. It holds the loaded function
// or nothing, never a URL, and is dropped as soon as the round ends, so a
// failed round is not served to a later delivery.
let returnHandlerLoadInFlight:
  | Promise<IBinanceDepositReturnHandler | undefined>
  | undefined;

// The handler is loaded on demand so that it stays off the startup graph;
// only the URL check above is imported statically. Resolves to undefined when
// every attempt failed. What a failed load reports may describe the URL being
// handled, so nothing that is caught here is inspected.
async function runBinanceDepositReturnHandlerLoad(): Promise<
  IBinanceDepositReturnHandler | undefined
> {
  for (
    let attempt = 0;
    attempt <= RETURN_HANDLER_LOAD_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    if (attempt > 0) {
      await waitFor(RETURN_HANDLER_LOAD_RETRY_DELAYS_MS[attempt - 1]);
    }
    try {
      const { handleBinanceDepositReturnFromOS } =
        await import('./binanceDepositReturn');
      return handleBinanceDepositReturnFromOS;
    } catch {
      // Tried again after the next delay, if there is one.
    }
  }
  return undefined;
}

// Single flight: the same return can be delivered more than once (the cold
// start URL is replayed, a listener is registered twice), and each delivery
// running a round of its own would spend the segment's failure budget twice.
// Deliveries that arrive while a round runs wait for that round instead.
function loadBinanceDepositReturnHandler(): Promise<
  IBinanceDepositReturnHandler | undefined
> {
  if (!returnHandlerLoadInFlight) {
    const endRound = () => {
      returnHandlerLoadInFlight = undefined;
    };
    returnHandlerLoadInFlight = runBinanceDepositReturnHandlerLoad();
    // Registered before any delivery awaits the round, so the round is
    // already dropped when their continuations run.
    void returnHandlerLoadInFlight.then(endRound, endRound);
  }
  return returnHandlerLoadInFlight;
}

// Never rejects. A return whose handler could not be loaded is dropped, and
// leaves one local log line that carries nothing but where it came from.
async function consumeBinanceDepositReturn(
  url: string,
  source: IBinanceDepositReturnSource,
): Promise<void> {
  try {
    const handleReturn = await loadBinanceDepositReturnHandler();
    if (!handleReturn) {
      defaultLogger.fiatCrypto.binanceDeposit.returnDiscarded({
        source,
        reason: RETURN_HANDLER_LOAD_FAILED_REASON,
      });
      return;
    }
    await handleReturn(url, source);
  } catch {
    // Dropped on purpose: the caught value may describe the URL.
  }
}

export const registerHandler: IRegisterHandler = (
  handleDeepLinkUrl: (e: IDesktopOpenUrlEventData) => void,
) => {
  const nativeLinkingHandler = (
    { url }: { url: string },
    binanceDepositReturnSource: IBinanceDepositReturnSource,
  ) => {
    // The Binance deposit return carries a one-time nonce. It is consumed
    // here, where only the OS can deliver it, and never enters the generic
    // pipeline, which logs the URL and forwards it to bg. It is not awaited:
    // loading its handler may take a second try, and other links go on.
    if (isBinanceConnectDeepLink(url)) {
      void consumeBinanceDepositReturn(url, binanceDepositReturnSource);
      return url;
    }
    // TODO: maybe need to edit WalletConnect landing page
    handleDeepLinkUrl({ url });
    return url;
  };

  void (async () => {
    const url = await Linking.getInitialURL();
    if (url) {
      nativeLinkingHandler({ url }, 'os_initial');
    }
  })();

  Linking.addEventListener('url', (event) =>
    nativeLinkingHandler(event, 'os_event'),
  );
};
