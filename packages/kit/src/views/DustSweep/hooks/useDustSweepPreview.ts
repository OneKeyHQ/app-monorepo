import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import pLimit from 'p-limit';

import type { IDustSweepSnapshot } from '@onekeyhq/shared/types/swap/dustSweep';

import { fetchDustSweepQuote, getDustSweepQuoteRisk } from '../utils/quote';

type IPreview = {
  identity: string;
  status: 'loading' | 'ready' | 'error';
  amount: string;
  quotedCount: number;
  providerLogo?: string;
};

export function useDustSweepPreview(
  snapshot: IDustSweepSnapshot | undefined,
): Omit<IPreview, 'identity'> {
  const [preview, setPreview] = useState<IPreview>();
  useEffect(() => {
    if (!snapshot || !snapshot.tokens.length) return undefined;
    const controller = new AbortController();
    const limit = pLimit(3);
    setPreview({
      identity: snapshot.id,
      status: 'loading',
      amount: '0',
      quotedCount: 0,
    });
    const timer = setTimeout(() => {
      void Promise.allSettled(
        snapshot.tokens.map((token) =>
          limit(async () => {
            if (controller.signal.aborted) return undefined;
            const quote = await fetchDustSweepQuote(
              token,
              snapshot,
              controller.signal,
            );
            return getDustSweepQuoteRisk(quote, token, snapshot)
              ? undefined
              : quote;
          }),
        ),
      ).then((results) => {
        if (controller.signal.aborted) return;
        const quotes = results.flatMap((result) =>
          result.status === 'fulfilled' && result.value ? [result.value] : [],
        );
        setPreview({
          identity: snapshot.id,
          status: quotes.length === snapshot.tokens.length ? 'ready' : 'error',
          amount: quotes
            .reduce(
              (sum, quote) => sum.plus(quote.toAmount ?? 0),
              new BigNumber(0),
            )
            .toFixed(),
          quotedCount: quotes.length,
          providerLogo: quotes[0]?.info.providerLogo,
        });
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [snapshot]);
  if (!snapshot?.tokens.length)
    return { status: 'ready' as const, amount: '0', quotedCount: 0 };
  if (preview?.identity !== snapshot.id)
    return { status: 'loading' as const, amount: '0', quotedCount: 0 };
  return preview;
}
