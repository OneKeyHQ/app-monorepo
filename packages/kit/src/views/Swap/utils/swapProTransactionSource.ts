import BigNumber from 'bignumber.js';

import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IRecentTrade } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';
import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';

export type ISwapProMarketDataSource = 'market' | 'hyperliquid';

export type ISwapProMarketTransaction = IMarketTokenTransaction & {
  timestampMs?: number;
};

type ISwapProTransactionToken = Pick<
  ISwapTokenBase,
  'networkId' | 'contractAddress' | 'isNative' | 'symbol'
>;

export function isSwapProHyperliquidBtcToken(
  token: Partial<ISwapProTransactionToken> | undefined,
) {
  return Boolean(
    token?.isNative &&
    networkUtils.isBTCMainnet(token.networkId) &&
    !token.contractAddress &&
    token.symbol?.toUpperCase() === 'BTC',
  );
}

export function getSwapProMarketDataSource({
  token,
}: {
  token: Partial<ISwapProTransactionToken> | undefined;
}): ISwapProMarketDataSource | undefined {
  if (!token?.networkId) {
    return undefined;
  }
  if (isSwapProHyperliquidBtcToken(token)) {
    return 'hyperliquid';
  }
  return 'market';
}

export function getSwapProTransactionTokenPrice(
  transaction: IMarketTokenTransaction,
) {
  return transaction.type === 'buy'
    ? transaction.to.price
    : transaction.from.price;
}

export function mapHyperliquidTradeToSwapProTransaction(
  trade: IRecentTrade,
): ISwapProMarketTransaction {
  const isBuy = trade.side === 'B';
  const quoteAmount = new BigNumber(trade.px).multipliedBy(trade.sz).toFixed();
  const token = {
    symbol: trade.coin,
    amount: trade.sz,
    address: '',
    price: trade.px,
  };
  const quote = {
    symbol: 'USD',
    amount: quoteAmount,
    address: '',
    price: '1',
  };

  return {
    pairAddress: '',
    // A single Hyperliquid transaction can contain multiple fills. Include
    // the trade ID so list deduplication does not collapse them.
    hash: `${trade.hash}:${trade.tid}`,
    owner: trade.users[1],
    type: isBuy ? 'buy' : 'sell',
    timestamp: Math.floor(trade.time / 1000),
    timestampMs: trade.time,
    url: '',
    from: isBuy ? quote : token,
    to: isBuy ? token : quote,
  };
}

export function mapHyperliquidTradesToSwapProTransactions(
  trades: IRecentTrade[],
) {
  return trades
    .map(mapHyperliquidTradeToSwapProTransaction)
    .toSorted((a, b) => (b.timestampMs ?? 0) - (a.timestampMs ?? 0));
}
