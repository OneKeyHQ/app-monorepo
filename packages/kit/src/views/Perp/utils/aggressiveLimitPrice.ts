import BigNumber from 'bignumber.js';

import type {
  IBBOPriceMode,
  ITradingFormData,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { getPerpsMarketDataLocalReceivedAt } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils';
import type { IPerpsBboWithLocalReceivedAt } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils';
import type { ITIF } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { isPerpsBboInteractive } from './l2BookFreshness';

export const PERPS_AGGRESSIVE_LIMIT_PRICE_THRESHOLD_PERCENT = 3;

export interface IAggressiveLimitPriceWarning {
  side: 'long' | 'short';
  deviationPercent: number;
  referencePrice: string;
}

export function shouldShowOrderConfirm({
  skipOrderConfirm,
  aggressiveLimitPriceWarning,
}: {
  skipOrderConfirm: boolean;
  aggressiveLimitPriceWarning?: IAggressiveLimitPriceWarning;
}) {
  return !skipOrderConfirm || Boolean(aggressiveLimitPriceWarning);
}

interface IGetAggressiveLimitPriceWarningParams {
  side: 'long' | 'short';
  limitPrice: string;
  bestBid?: string;
  bestAsk?: string;
  thresholdPercent?: number;
}

export function getAggressiveLimitPriceWarning({
  side,
  limitPrice,
  bestBid,
  bestAsk,
  thresholdPercent = PERPS_AGGRESSIVE_LIMIT_PRICE_THRESHOLD_PERCENT,
}: IGetAggressiveLimitPriceWarningParams):
  | IAggressiveLimitPriceWarning
  | undefined {
  const price = new BigNumber(limitPrice);
  const referencePrice = new BigNumber(
    side === 'long' ? (bestAsk ?? '') : (bestBid ?? ''),
  );
  const threshold = new BigNumber(thresholdPercent);
  if (
    !price.isFinite() ||
    price.lte(0) ||
    !referencePrice.isFinite() ||
    referencePrice.lte(0) ||
    !threshold.isFinite() ||
    threshold.lt(0)
  ) {
    return undefined;
  }

  const deviation =
    side === 'long'
      ? price.minus(referencePrice).dividedBy(referencePrice).multipliedBy(100)
      : referencePrice.minus(price).dividedBy(referencePrice).multipliedBy(100);
  if (!deviation.isFinite() || deviation.lt(threshold)) {
    return undefined;
  }

  return {
    side,
    deviationPercent: deviation.toNumber(),
    referencePrice: referencePrice.toFixed(),
  };
}

interface IGetAggressiveLimitPriceWarningFromBboParams {
  coin: string;
  side: 'long' | 'short';
  type: ITradingFormData['type'];
  orderMode: ITradingFormData['orderMode'];
  limitPrice: string;
  limitTif?: ITIF;
  bboPriceMode?: IBBOPriceMode;
  bbo: IPerpsBboWithLocalReceivedAt | null;
  now?: number;
}

export function getAggressiveLimitPriceWarningFromBbo({
  coin,
  side,
  type,
  orderMode,
  limitPrice,
  limitTif,
  bboPriceMode,
  bbo,
  now = Date.now(),
}: IGetAggressiveLimitPriceWarningFromBboParams):
  | IAggressiveLimitPriceWarning
  | undefined {
  if (
    type !== 'limit' ||
    orderMode !== 'standard' ||
    bboPriceMode ||
    limitTif === 'Alo' ||
    bbo?.coin !== coin ||
    !bbo.bbo?.[0] ||
    !bbo.bbo?.[1] ||
    !isPerpsBboInteractive({
      bboTime: bbo.time,
      bboReceivedAt: getPerpsMarketDataLocalReceivedAt(bbo),
      now,
    })
  ) {
    return undefined;
  }

  return getAggressiveLimitPriceWarning({
    side,
    limitPrice,
    bestBid: bbo.bbo[0].px,
    bestAsk: bbo.bbo[1].px,
  });
}
