import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import pLimit from 'p-limit';

import type {
  IDustSweepReason,
  IDustSweepSnapshot,
} from '@onekeyhq/shared/types/swap/dustSweep';

import {
  DustSweepSkip,
  fetchDustSweepQuote,
  getDustSweepQuoteRisk,
} from '../utils/quote';

type IPreview = {
  identity: string;
  revision: number;
  status: 'idle' | 'loading' | 'refreshing' | 'ready' | 'partial' | 'error';
  amount: string;
  quotedCount: number;
  availableKeys: string[];
  unavailable: Record<string, IDustSweepReason>;
  providers: {
    provider: string;
    providerName?: string;
    providerLogo?: string;
  }[];
};

export function useDustSweepPreview(
  snapshot: IDustSweepSnapshot | undefined,
  {
    enabled = true,
    revision = 0,
  }: { enabled?: boolean; revision?: number } = {},
): Omit<IPreview, 'identity' | 'revision'> {
  const [preview, setPreview] = useState<IPreview>();
  useEffect(() => {
    if (!enabled || !snapshot || !snapshot.tokens.length) {
      setPreview((previous) =>
        previous ? { ...previous, status: 'idle' } : previous,
      );
      return undefined;
    }
    const controller = new AbortController();
    const limit = pLimit(3);
    setPreview((previous) =>
      previous?.identity === snapshot.id
        ? { ...previous, revision, status: 'refreshing' }
        : {
            identity: snapshot.id,
            revision,
            status: 'loading',
            amount: '0',
            quotedCount: 0,
            availableKeys: [],
            unavailable: {},
            providers: [],
          },
    );
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
            const reason = getDustSweepQuoteRisk(quote, token, snapshot);
            if (reason) throw new DustSweepSkip(reason);
            return quote;
          }),
        ),
      ).then((results) => {
        if (controller.signal.aborted) return;
        const quotes = results.flatMap((result) =>
          result.status === 'fulfilled' && result.value ? [result.value] : [],
        );
        const availableKeys: string[] = [];
        const unavailable: Record<string, IDustSweepReason> = {};
        results.forEach((result, index) => {
          const key = snapshot.tokens[index].key;
          if (result.status === 'fulfilled' && result.value) {
            availableKeys.push(key);
          } else {
            unavailable[key] =
              result.status === 'rejected' &&
              result.reason instanceof DustSweepSkip
                ? result.reason.reason
                : 'noQuote';
          }
        });
        const providers = Array.from(
          new Map(
            quotes.map((quote) => [quote.info.provider, quote.info]),
          ).values(),
        );
        let status: IPreview['status'] = 'error';
        if (quotes.length === snapshot.tokens.length) status = 'ready';
        else if (quotes.length) status = 'partial';
        setPreview({
          identity: snapshot.id,
          revision,
          status,
          amount: quotes
            .reduce(
              (sum, quote) => sum.plus(quote.toAmount ?? 0),
              new BigNumber(0),
            )
            .toFixed(),
          quotedCount: quotes.length,
          availableKeys,
          unavailable,
          providers,
        });
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [snapshot, enabled, revision]);
  const empty = {
    amount: '0',
    quotedCount: 0,
    availableKeys: [],
    unavailable: {},
    providers: [],
  };
  if (!enabled || !snapshot?.tokens.length) return { ...empty, status: 'idle' };
  if (preview?.identity !== snapshot.id) return { ...empty, status: 'loading' };
  if (preview.revision !== revision)
    return { ...preview, status: 'refreshing' };
  if (preview.status === 'idle') return { ...preview, status: 'refreshing' };
  return preview;
}
