import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import { EStrk20ErrorCode } from '@onekeyhq/shared/types/starknetPrivacy';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { useStarknetPrivacySession } from './useStarknetPrivacySession';

type IPage = Awaited<
  ReturnType<
    typeof backgroundApiProxy.serviceStarknetPrivacy.fetchPrivateHistory
  >
>;

function normalizeHistoryTxKey(tx: IPage['txs'][number]): string {
  const txid = tx.decodedTx?.txid;
  if (txid) {
    try {
      return BigInt(txid).toString();
    } catch {
      return txid.toLowerCase();
    }
  }
  return tx.id;
}

function mergeHistoryPages(
  current: IPage['txs'],
  next: IPage['txs'],
): IPage['txs'] {
  const merged: IPage['txs'] = [];
  const indexByKey = new Map<string, number>();
  for (const tx of [...current, ...next]) {
    const key = normalizeHistoryTxKey(tx);
    const existingIdx = indexByKey.get(key);
    if (existingIdx === undefined) {
      indexByKey.set(key, merged.length);
      merged.push(tx);
    } else if (
      merged[existingIdx].decodedTx?.status === EDecodedTxStatus.Pending &&
      tx.decodedTx?.status !== EDecodedTxStatus.Pending
    ) {
      // Prefer the settled discovery record over a stale local pending row.
      merged[existingIdx] = tx;
    }
  }
  return merged;
}
function historyError(error: unknown) {
  const mapped = mapStrk20Error(error);
  return mapped.code === EStrk20ErrorCode.Unknown
    ? {
        ...mapped,
        code: EStrk20ErrorCode.History,
        translationKey: ETranslations.global_sync_error,
      }
    : mapped;
}

function deniesHistoryAccess(code?: EStrk20ErrorCode) {
  return (
    code === EStrk20ErrorCode.Locked ||
    code === EStrk20ErrorCode.KeyMismatch ||
    code === EStrk20ErrorCode.Unavailable
  );
}

type IHistoryResult = {
  identity: string;
  page?: IPage;
  errorKey?: ReturnType<typeof historyError>['translationKey'];
  errorCode?: EStrk20ErrorCode;
};

export function useStarknetPrivateHistory({
  networkId,
  accountId,
  tokenAddress,
  focused,
}: {
  networkId: string;
  accountId: string;
  tokenAddress: string;
  focused: boolean;
}) {
  const lastSuccess = useRef<
    | {
        identity: string;
        page: IPage;
        firstPageIds: Set<string>;
        loadedMore: boolean;
      }
    | undefined
  >(undefined);
  const accountScope = [networkId, accountId, tokenAddress].join('|');
  const disabledScope = useRef<string>(undefined);
  const session = useStarknetPrivacySession({
    skipUnlock: () => disabledScope.current === accountScope,
    onLock: () => {
      lastSuccess.current = undefined;
    },
  });
  const identity = [accountScope, session].join('|');
  const identityRef = useRef(identity);
  identityRef.current = identity;
  // A denial on a later page also invalidates a first-page refresh already in flight.
  const accessReset = useRef<IHistoryResult | undefined>(undefined);
  const readPage = useCallback(
    async (cursor?: IPage['cursor']): Promise<IHistoryResult> => {
      const resetAtStart = accessReset.current;
      let response: IHistoryResult;
      try {
        const page =
          await backgroundApiProxy.serviceStarknetPrivacy.fetchPrivateHistory({
            networkId,
            accountId,
            tokenAddress,
            cursor,
          });
        response = { identity, page };
      } catch (error) {
        const { code, translationKey } = historyError(error);
        response = { identity, errorKey: translationKey, errorCode: code };
      }
      if (identityRef.current !== identity) return response;
      if (accessReset.current && accessReset.current !== resetAtStart)
        return accessReset.current;
      if (response.page)
        disabledScope.current =
          response.page.isEnabled === false ? accountScope : undefined;
      if (
        response.page?.isEnabled === false ||
        deniesHistoryAccess(response.errorCode)
      ) {
        lastSuccess.current = undefined;
        accessReset.current = response;
      }
      return response;
    },
    [identity, accountScope, accountId, networkId, tokenAddress],
  );
  const { result, isLoading, run, setResult } = usePromiseResult(
    async (): Promise<IHistoryResult> => {
      const response = await readPage();
      if (identityRef.current !== identity || response === accessReset.current)
        return response;
      const previous = lastSuccess.current;
      let { page } = response;
      if (!page)
        return {
          ...response,
          page: previous?.identity === identity ? previous.page : undefined,
        };
      const firstPageIds = new Set(page.discoveryTxIds);
      const preserveRange =
        previous?.identity === identity &&
        previous.loadedMore &&
        page.discoveryTxIds.some((id) => previous.firstPageIds.has(id));
      if (preserveRange) {
        page = {
          ...page,
          txs: mergeHistoryPages(page.txs, previous.page.txs),
          hasMore: previous.page.hasMore,
          cursor: previous.page.cursor,
        };
      }
      lastSuccess.current = {
        identity,
        page,
        firstPageIds,
        loadedMore: !!preserveRange,
      };
      return { identity, page };
    },
    [readPage, identity],
    {
      watchLoading: true,
      resumeOnEffectReconnect: true,
      revalidateOnFocus: true,
      pollingInterval: lastSuccess.current?.page.txs.some(
        (tx) => tx.decodedTx.status === EDecodedTxStatus.Pending,
      )
        ? 10_000
        : 60_000,
      overrideIsFocused: (routeFocused) => routeFocused && focused,
    },
  );
  const resultRef = useRef(result);
  resultRef.current = result;
  const [extra, setExtra] = useState<{ base: typeof result; page: IPage }>();
  const [moreError, setMoreError] = useState<{
    base: typeof result;
    key: ReturnType<typeof historyError>['translationKey'];
  }>();
  const [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0);
  const inFlight = useRef(false);
  useEffect(() => {
    request.current += 1;
    inFlight.current = false;
    setLoadingMore(false);
    return () => {
      request.current += 1;
      inFlight.current = false;
    };
  }, [identity]);
  let page: IPage | undefined;
  if (result?.identity === identity)
    page = extra?.base === result ? extra.page : result.page;
  const loadMore = useCallback(async () => {
    if (!focused || inFlight.current || !page?.hasMore || !page.cursor) return;
    request.current += 1;
    const requestId = request.current;
    const base = result;
    inFlight.current = true;
    setLoadingMore(true);
    setMoreError(undefined);
    try {
      const response = await readPage(page.cursor);
      if (request.current !== requestId || identityRef.current !== identity)
        return;
      if (response === accessReset.current) {
        setExtra(undefined);
        setResult(response);
        return;
      }
      if (resultRef.current !== base) return;
      const next = response.page;
      if (next?.cursorExpired) {
        // Evicted background cursor: reset retained range and fetch a fresh first page.
        lastSuccess.current = undefined;
        setExtra(undefined);
        void run();
        return;
      }
      if (next) {
        const merged = {
          ...next,
          txs: mergeHistoryPages(page.txs, next.txs),
        };
        const previous = lastSuccess.current;
        lastSuccess.current = {
          identity,
          page: merged,
          firstPageIds:
            previous?.identity === identity
              ? previous.firstPageIds
              : new Set(page.discoveryTxIds),
          loadedMore: true,
        };
        setExtra({ base, page: merged });
      } else if (response.errorKey) {
        setMoreError({ base, key: response.errorKey });
      }
    } finally {
      if (request.current === requestId) {
        inFlight.current = false;
        setLoadingMore(false);
      }
    }
  }, [focused, identity, page, result, readPage, run, setResult]);
  const reload = useCallback(() => {
    void run();
  }, [run]);
  useEffect(() => {
    appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, reload);
    return () => {
      appEventBus.off(EAppEventBusNames.HistoryTxStatusChanged, reload);
    };
  }, [reload]);
  return {
    txs: page?.txs ?? [],
    isEnabled: page?.isEnabled,
    hasMore: page?.hasMore ?? false,
    cursorId: page?.cursor?.cursorId,
    initialized: result?.identity === identity,
    errorKey: result?.identity === identity ? result.errorKey : undefined,
    errorCode: result?.identity === identity ? result.errorCode : undefined,
    moreErrorKey: moreError?.base === result ? moreError?.key : undefined,
    isLoading,
    loadingMore,
    loadMore,
    reload,
  };
}
