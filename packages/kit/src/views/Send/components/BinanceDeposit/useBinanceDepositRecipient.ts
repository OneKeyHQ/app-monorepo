import type { IToken } from '@onekeyhq/shared/types/token';

import { useBinanceDepositEntry } from './useBinanceDepositEntry';
import { useBinanceDepositEvents } from './useBinanceDepositEvents';
import { useBinanceDepositSession } from './useBinanceDepositSession';

// The Binance deposit on the recipient step: the entry under the address
// input and the session behind the card that replaces it.
export function useBinanceDepositRecipient(params: {
  accountId: string;
  networkId: string;
  token?: IToken | null;
  isNFT: boolean;
}) {
  const entry = useBinanceDepositEntry(params);
  const session = useBinanceDepositSession({
    asset: entry.asset,
    onAssetStale: entry.refreshAsset,
    onAssetDisabled: entry.hideAsset,
  });
  const snapshot = session.snapshot ?? undefined;
  useBinanceDepositEvents(snapshot);

  return {
    isEntryAvailable: entry.isEntryAvailable,
    reportEntryShown: entry.reportEntryShown,
    // The card takes over from the tap, before the server has answered.
    isActive: session.snapshot !== undefined,
    snapshot,
    isBusy: session.isBusy,
    // Binance is being opened; the card holds its opening state till then.
    isOpening: session.isOpening,
    isResuming: session.isResuming,
    start: session.start,
    retryCreate: session.retryCreate,
    reopenBinance: session.reopenBinance,
    exit: session.exit,
  };
}
