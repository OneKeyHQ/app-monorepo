import { useCallback, useEffect, useRef, useState } from 'react';

import { unionBy } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import { EStrk20ErrorCode } from '@onekeyhq/shared/types/starknetPrivacy';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

type IPage = Awaited<
  ReturnType<
    typeof backgroundApiProxy.serviceStarknetPrivacy.fetchPrivateHistory
  >
>;
function historyError(error: unknown) {
  const mapped = mapStrk20Error(error);
  return mapped.code === EStrk20ErrorCode.Unknown
    ? {
        ...mapped,
        code: EStrk20ErrorCode.History,
        translationKey: ETranslationsMock.starknet_privacy_error_history,
      }
    : mapped;
}

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
  const [lockGeneration, setLockGeneration] = useState(0);
  const identity = [networkId, accountId, tokenAddress, lockGeneration].join(
    '|',
  );
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const lastSuccess = useRef<
    | {
        identity: string;
        page: IPage;
        firstPageIds: Set<string>;
        loadedMore: boolean;
      }
    | undefined
  >(undefined);
  useEffect(() => {
    const onLock = () => {
      lastSuccess.current = undefined;
      setLockGeneration((value) => value + 1);
    };
    appEventBus.on(EAppEventBusNames.LockApp, onLock);
    return () => {
      appEventBus.off(EAppEventBusNames.LockApp, onLock);
    };
  }, []);
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      try {
        let page =
          await backgroundApiProxy.serviceStarknetPrivacy.fetchPrivateHistory({
            networkId,
            accountId,
            tokenAddress,
          });
        if (identityRef.current === identity) {
          const previous = lastSuccess.current;
          const firstPageIds = new Set(page.txs.map((tx) => tx.id));
          const preserveRange =
            previous?.identity === identity &&
            previous.loadedMore &&
            page.isEnabled !== false &&
            page.txs.some(
              (tx) =>
                previous.firstPageIds.has(tx.id) &&
                !(
                  tx.isLocalCreated &&
                  tx.decodedTx.status === EDecodedTxStatus.Pending
                ),
            );
          if (preserveRange) {
            page = {
              ...previous.page,
              ...page,
              txs: unionBy([...page.txs, ...previous.page.txs], (tx) => tx.id),
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
        }
        return { identity, page, errorKey: undefined, errorCode: undefined };
      } catch (error) {
        const { translationKey: errorKey, code: errorCode } =
          historyError(error);
        const previous = lastSuccess.current;
        const retain =
          previous?.identity === identity &&
          errorCode !== EStrk20ErrorCode.Locked;
        if (!retain && identityRef.current === identity)
          lastSuccess.current = undefined;
        return {
          identity,
          page: retain ? previous.page : undefined,
          errorKey,
          errorCode,
        };
      }
    },
    [accountId, identity, networkId, tokenAddress],
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
    const current = () =>
      request.current === requestId &&
      identityRef.current === identity &&
      resultRef.current === base;
    inFlight.current = true;
    setLoadingMore(true);
    setMoreError(undefined);
    try {
      const next =
        await backgroundApiProxy.serviceStarknetPrivacy.fetchPrivateHistory({
          networkId,
          accountId,
          tokenAddress,
          cursor: page.cursor,
        });
      if (current()) {
        const merged = {
          ...next,
          txs: unionBy([...page.txs, ...next.txs], (tx) => tx.id),
        };
        const previous = lastSuccess.current;
        lastSuccess.current = {
          identity,
          page: merged,
          firstPageIds:
            previous?.identity === identity
              ? previous.firstPageIds
              : new Set(page.txs.map((tx) => tx.id)),
          loadedMore: true,
        };
        setExtra({
          base,
          page: merged,
        });
      }
    } catch (error) {
      if (current())
        setMoreError({ base, key: historyError(error).translationKey });
    } finally {
      if (request.current === requestId) {
        inFlight.current = false;
        setLoadingMore(false);
      }
    }
  }, [accountId, focused, identity, networkId, page, result, tokenAddress]);
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
