import { maxRecentTokenPairs } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

type IRecentTokenPairLike = {
  fromToken: { networkId?: string };
  toToken: { networkId?: string };
};

export function isCrossChainTokenPair(pair: IRecentTokenPairLike) {
  return pair.fromToken.networkId !== pair.toToken.networkId;
}

/**
 * Caps the stored recent token pairs while PRESERVING the global
 * most-recent-first order of the input.
 *
 * Every writer inserts the newest pair at the head, so the input order IS
 * the recency order. The previous implementation split the list into
 * single-chain / cross-chain buckets and re-concatenated them
 * (singles first), which destroyed the global order — the UI's top-N
 * display could then never show a just-completed cross-chain trade once
 * ten single-chain pairs existed.
 *
 * Each bucket still keeps at most `maxPerBucket` entries so one busy
 * trade type cannot purge the other's history from storage; the display
 * layer takes the global top-N (mixed types) off the head.
 */
export function capRecentTokenPairsPreservingOrder<
  T extends IRecentTokenPairLike,
>(pairs: T[], maxPerBucket: number = maxRecentTokenPairs): T[] {
  let singleChainCount = 0;
  let crossChainCount = 0;
  return pairs.filter((pair) => {
    if (isCrossChainTokenPair(pair)) {
      crossChainCount += 1;
      return crossChainCount <= maxPerBucket;
    }
    singleChainCount += 1;
    return singleChainCount <= maxPerBucket;
  });
}
