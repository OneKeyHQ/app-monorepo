import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import * as Linking from 'expo-linking';

import {
  BINANCE_DEPOSIT_RETURN_HANDLE_TIMEOUT_MS,
  BINANCE_DEPOSIT_RETURN_RETRYABLE_REASONS,
} from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { parseBinanceDepositReturnUrl } from '@onekeyhq/shared/src/utils/binanceDepositUtils';
import type {
  IBinanceDepositReturnResult,
  IBinanceDepositReturnSource,
} from '@onekeyhq/shared/types/exchange';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { isBinanceConnectDeepLink } from './binanceConnectDeepLink';

// Handles the deep link Binance redirects to once the user has authorized a
// deposit: onekey-wallet://binance-connect/deposit-return?rn=<return nonce>.
//
// The URL carries a one-time nonce. Nothing in this file logs the URL, the
// nonce or an error message, keeps the URL beyond the call, navigates, shows
// UI or waits for the app to be unlocked. The nonce is handed to bg, which
// decides whether a session is waiting for it and runs the bind; the deposit
// page sees the outcome by polling the service state.

// This file is loaded on demand (handler.native.ts, the deposit page). The
// check that decides whether a URL belongs here lives in
// binanceConnectDeepLink.ts, which is all the startup path imports.

// Repeats of one return are expected: every re-registration of the deep link
// handler replays the cold start URL and adds one more `url` listener, and
// split view registers twice. Entries are keyed by the SHA-256 of the URL so
// the URL itself is never retained; the value is the time until which a
// repeat is ignored, Infinity while the first arrival is still being handled.
// bg deduplicates by nonce on its own, this only spares it the burst.
const RETURN_DEDUPE_WINDOW_MS = 5000;
const RETURN_DEDUPE_MAX_ENTRIES = 32;
const handledReturns = new Map<string, number>();

function isRepeatedReturn(digest: string, now: number): boolean {
  handledReturns.forEach((ignoreUntil, key) => {
    if (ignoreUntil <= now) {
      handledReturns.delete(key);
    }
  });
  if (handledReturns.has(digest)) {
    return true;
  }
  handledReturns.set(digest, Number.POSITIVE_INFINITY);
  // Stays bounded under a flood of distinct URLs. Evicting an entry only
  // costs one more bg call for its repeat.
  while (handledReturns.size > RETURN_DEDUPE_MAX_ENTRIES) {
    const oldest = handledReturns.keys().next();
    if (oldest.done) {
      break;
    }
    handledReturns.delete(oldest.value);
  }
  return false;
}

type ITimedResult<T> = { timedOut: true } | { timedOut: false; value: T };

async function waitWithTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
): Promise<ITimedResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ITimedResult<T>>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
  });
  try {
    return await Promise.race([
      task.then((value): ITimedResult<T> => ({ timedOut: false, value })),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function logReturnDiscarded({
  source,
  reason,
  otherParamNames,
}: {
  source: IBinanceDepositReturnSource;
  reason: string;
  otherParamNames: string[];
}) {
  defaultLogger.fiatCrypto.binanceDeposit.returnDiscarded({
    source,
    reason,
    otherParamNames: otherParamNames.length > 0 ? otherParamNames : undefined,
  });
}

// A return dropped in this runtime never reaches the service, so the deposit
// page, which only shows the service's events, would see nothing at all. This
// mirrors the discard into those events. Only the fixed reason, the parameter
// names and the source are sent: never the URL or anything read from `rn`.
// Best effort: a failure or a timeout changes nothing and is not logged.
async function reportReturnDiscardedToBackground(params: {
  source: IBinanceDepositReturnSource;
  reason: string;
  otherParamNames: string[];
}): Promise<void> {
  try {
    await waitWithTimeout(
      backgroundApiProxy.serviceBinanceDeposit.recordReturnDiscardedByMain(
        params,
      ),
      BINANCE_DEPOSIT_RETURN_HANDLE_TIMEOUT_MS,
    );
  } catch {
    // Not inspected, as for every other background failure in this file.
  }
}

// Resolves to whether the return was settled, one way or the other. An
// unsettled one (bg unreachable, timed out, or told to come back later) is
// forgotten right away so that a later delivery of the same URL is tried
// again.
async function deliverReturn(
  url: string,
  source: IBinanceDepositReturnSource,
): Promise<boolean> {
  const { returnNonce, otherParamNames, reason } =
    parseBinanceDepositReturnUrl(url);
  if (!returnNonce) {
    const discard = {
      source,
      reason: reason ?? 'malformed_rn',
      otherParamNames,
    };
    logReturnDiscarded(discard);
    await reportReturnDiscardedToBackground(discard);
    return true;
  }

  let outcome: ITimedResult<IBinanceDepositReturnResult>;
  try {
    // main -> bg calls wait up to 10 minutes by default (and queue while the
    // bg runtime is still starting), far longer than this handler may hang.
    outcome = await waitWithTimeout(
      backgroundApiProxy.serviceBinanceDeposit.handleDepositReturn({
        returnNonce,
        otherParamNames,
        source,
      }),
      BINANCE_DEPOSIT_RETURN_HANDLE_TIMEOUT_MS,
    );
  } catch {
    // The error is deliberately not inspected: nothing guarantees that its
    // message is free of the call parameters.
    logReturnDiscarded({ source, reason: 'bg_call_failed', otherParamNames });
    return false;
  }
  if (outcome.timedOut) {
    // Only the wait is given up. A call still queued for bg may be delivered
    // later; bg copes with the nonce arriving twice.
    logReturnDiscarded({ source, reason: 'bg_call_timeout', otherParamNames });
    return false;
  }
  // bg logs both outcomes itself, nothing to add here.
  const { accepted, reason: discardReason } = outcome.value;
  // A discard that leaves the return unresolved is not settled: a later
  // delivery of the same URL may still get through.
  return (
    accepted ||
    !BINANCE_DEPOSIT_RETURN_RETRYABLE_REASONS.has(discardReason ?? '')
  );
}

// expo-linking keeps the last opened URL in a native static. A settled return
// is dropped from there, so the foreground fallback does not read it again
// and the nonce does not linger in memory. A newer URL that has replaced it
// in the meantime is left alone.
function forgetSettledLinkingUrl(url: string) {
  if (!platformEnv.isNative) {
    return;
  }
  try {
    if (Linking.getLinkingURL() === url) {
      Linking.clearInitialURL();
    }
  } catch {
    // The native module of an older app shell may lack these methods.
  }
}

// Entry for a Binance deposit return delivered by the operating system. Only
// handler.native.ts and the foreground fallback below may call it: the same
// URL shape coming from inside the app (DApp browser, webview, banner href)
// is dropped by the generic deep link handler instead.
//
// Fire-and-forget for every caller: never rejects.
export async function handleBinanceDepositReturnFromOS(
  url: string,
  source: IBinanceDepositReturnSource,
): Promise<void> {
  try {
    if (typeof url !== 'string' || !url) {
      return;
    }
    // Everything up to the first await runs synchronously, so listeners
    // firing in the same tick for one event are already deduplicated.
    const digest = bytesToHex(sha256(url));
    if (isRepeatedReturn(digest, Date.now())) {
      return;
    }
    let settled = false;
    try {
      settled = await deliverReturn(url, source);
    } finally {
      if (settled) {
        handledReturns.set(digest, Date.now() + RETURN_DEDUPE_WINDOW_MS);
      } else {
        handledReturns.delete(digest);
      }
    }
    if (settled) {
      forgetSettledLinkingUrl(url);
    }
  } catch {
    // Same as above: the error may describe its input, so it is not logged.
  }
}

// Safety net for a return whose `url` event never reached JS: Android drops
// it while the React context or the listener is not ready yet. To be called
// when the app comes back to the foreground while a deposit session is still
// waiting for its return. Reads the last URL the OS opened the app with from
// expo-linking, which, unlike Linking.getInitialURL() on Android, also
// reflects intents received after launch.
//
// Does nothing on other platforms. Never rejects.
export async function recoverBinanceDepositReturnOnForeground(): Promise<void> {
  if (!platformEnv.isNative) {
    return;
  }
  let url: string | null;
  try {
    url = Linking.getLinkingURL();
  } catch {
    // The native module of an older app shell may lack this method.
    return;
  }
  if (typeof url !== 'string' || !isBinanceConnectDeepLink(url)) {
    return;
  }
  await handleBinanceDepositReturnFromOS(url, 'foreground_fallback');
}
