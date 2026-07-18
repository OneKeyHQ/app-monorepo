import { getSwapTokenIdentityKey } from '@onekeyhq/shared/src/utils/swapTokenIdentity';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export enum ESwapStockMarketQuoteGateStatus {
  Checking = 'checking',
  Allowed = 'allowed',
  Closed = 'closed',
}

export type ISwapStockMarketQuoteGate = {
  ownerStockKey: string;
  status: ESwapStockMarketQuoteGateStatus;
};

export function getSwapStockMarketQuoteOwnerKey({
  fromToken,
  toToken,
}: {
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  let stockToken: ISwapToken | undefined;
  if (fromToken?.isStock) {
    stockToken = fromToken;
  } else if (toToken?.isStock) {
    stockToken = toToken;
  }
  return getSwapTokenIdentityKey(stockToken);
}

export function isSwapStockMarketQuoteBlocked({
  fromToken,
  gate,
  toToken,
}: {
  fromToken?: ISwapToken;
  gate?: ISwapStockMarketQuoteGate;
  toToken?: ISwapToken;
}) {
  const ownerStockKey = getSwapStockMarketQuoteOwnerKey({
    fromToken,
    toToken,
  });
  return Boolean(
    !ownerStockKey ||
    !gate ||
    gate.ownerStockKey !== ownerStockKey ||
    gate.status !== ESwapStockMarketQuoteGateStatus.Allowed,
  );
}

export function isSwapStockMarketQuoteClosed({
  fromToken,
  gate,
  toToken,
}: {
  fromToken?: ISwapToken;
  gate?: ISwapStockMarketQuoteGate;
  toToken?: ISwapToken;
}) {
  return Boolean(
    gate?.status === ESwapStockMarketQuoteGateStatus.Closed &&
    gate.ownerStockKey ===
      getSwapStockMarketQuoteOwnerKey({ fromToken, toToken }),
  );
}
