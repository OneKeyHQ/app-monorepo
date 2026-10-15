import type { IBinanceDepositFailReason } from '@onekeyhq/shared/types/exchange';

// Demo copy, English only. Moves to ETranslations once product copy is final.
export const BINANCE_DEPOSIT_COPY = {
  accountName: 'My Binance account',
  entrySubtitle: 'Authorize in the Binance app to fill in your deposit address',
  creating: 'Starting authorization…',
  createFailedTitle: 'Couldn’t start the authorization',
  createFailedDesc: 'Check your network and try again.',
  awaitingTitle: 'Waiting for authorization',
  awaitingDesc:
    'Approve in the Binance app. You’ll come back here automatically.',
  awaitingUnboundDesc:
    'Approved in Binance but not brought back here? Start again.',
  confirming: 'Confirming authorization…',
  tag: 'Tag',
  minDeposit: 'Min. deposit',
  openBinance: 'Open Binance',
  cancel: 'Cancel',
  change: 'Change',
  tryAgain: 'Try again',
  startAgain: 'Start again',
  enterAddress: 'Enter address instead',
  failed: {
    expired: {
      title: 'Authorization expired',
      desc: 'Start again to get a new authorization link.',
    },
    rejected: {
      title: 'Authorization declined',
      desc: 'The authorization was declined in Binance.',
    },
    conflict: {
      title: 'Security check failed',
      desc: 'This deposit address can’t be used. Start again.',
    },
    bind_invalid: {
      title: 'Couldn’t confirm on this device',
      desc: 'Start again from this device.',
    },
    session_lost: {
      title: 'Authorization not found',
      desc: 'Start again.',
    },
  } satisfies Record<
    IBinanceDepositFailReason,
    { title: string; desc: string }
  >,
  toastUnavailable:
    'Binance deposit is unavailable right now. Try again later.',
  toastRateLimited: 'Too many requests. Try again later.',
  toastAssetUnavailable: 'This asset can’t be deposited to Binance right now.',
  toastRequestFailed: 'Binance deposit request failed. Try again.',
  toastOpenFailed: 'Couldn’t open Binance.',
  verifyFailed:
    'Couldn’t verify your Binance deposit address. Nothing was sent.',
  minAmount: (amount: string, symbol: string) =>
    `Minimum deposit is ${amount} ${symbol}`,
};
