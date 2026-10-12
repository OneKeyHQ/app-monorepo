import { useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import pLimit from 'p-limit';

import {
  ESwapQuoteRefreshAction,
  resolveSwapQuoteRefreshAction,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/quoteProgress';
import type {
  IDustSweepReason,
  IDustSweepSnapshot,
} from '@onekeyhq/shared/types/swap/dustSweep';
import {
  SWAP_QUOTE_INPUT_DEBOUNCE_MS,
  swapQuoteIntervalMaxCount,
  swapRefreshInterval,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { DustSweepSkip, fetchDustSweepQuote } from '../utils/quote';

type IPreview = {
  identity: string;
  revision: number;
  status:
    | 'idle'
    | 'loading'
    | 'refreshing'
    | 'ready'
    | 'partial'
    | 'error'
    | 'expired';
  autoRefreshTimerActive: boolean;
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
        previous
          ? { ...previous, status: 'idle', autoRefreshTimerActive: false }
          : previous,
      );
      return undefined;
    }
    const controller = new AbortController();
    const limit = pLimit(3);
    let automaticRefreshCount = 0;
    let timer: ReturnType<typeof setTimeout>;
    setPreview((previous) =>
      previous?.identity === snapshot.id
        ? {
            ...previous,
            revision,
            status: 'refreshing',
            autoRefreshTimerActive: false,
          }
        : {
            identity: snapshot.id,
            revision,
            status: 'loading',
            autoRefreshTimerActive: false,
            amount: '0',
            quotedCount: 0,
            availableKeys: [],
            unavailable: {},
            providers: [],
          },
    );
    const requestQuotes = () => {
      void Promise.allSettled(
        snapshot.tokens.map((token) =>
          limit(async () => {
            if (controller.signal.aborted) return undefined;
            return fetchDustSweepQuote(token, snapshot, controller.signal);
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
        const refreshTransition = resolveSwapQuoteRefreshAction({
          automaticRefreshCount,
          maxAutomaticRefreshCount: swapQuoteIntervalMaxCount,
        });
        const expired =
          refreshTransition.action ===
          ESwapQuoteRefreshAction.RequireManualRefresh;
        setPreview({
          identity: snapshot.id,
          revision,
          status: expired ? 'expired' : status,
          autoRefreshTimerActive: !expired,
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
        if (expired) return;
        timer = setTimeout(() => {
          if (controller.signal.aborted) return;
          automaticRefreshCount = refreshTransition.nextAutomaticRefreshCount;
          setPreview((previous) =>
            previous
              ? {
                  ...previous,
                  status: 'refreshing',
                  autoRefreshTimerActive: false,
                }
              : previous,
          );
          requestQuotes();
        }, swapRefreshInterval);
      });
    };
    timer = setTimeout(requestQuotes, SWAP_QUOTE_INPUT_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [snapshot, enabled, revision]);
  const empty = {
    autoRefreshTimerActive: false,
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
