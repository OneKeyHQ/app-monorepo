import { useCallback, useEffect, useRef, useState } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsEnableTransferAllowList } from '@onekeyhq/kit/src/components/AddressInput/hooks';
import { canOpenExchangeApp } from '@onekeyhq/kit/src/hooks/useExchangeAppDetection';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EExchangeId } from '@onekeyhq/shared/src/consts/exchangeConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EBinanceDepositErrorCode } from '@onekeyhq/shared/types/exchange';
import type { IBinanceDepositSnapshot } from '@onekeyhq/shared/types/exchange';
import type { IToken } from '@onekeyhq/shared/types/token';

import { BINANCE_DEPOSIT_COPY } from './binanceDepositCopy';

// Local reads only; the service asks the server at its own pace.
const SNAPSHOT_POLL_INTERVAL_MS = 1500;

function isSameSnapshot(
  a: IBinanceDepositSnapshot | null | undefined,
  b: IBinanceDepositSnapshot | undefined,
): boolean {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.localId === b.localId &&
      a.phase === b.phase &&
      a.status === b.status &&
      a.failReason === b.failReason &&
      a.destination?.address === b.destination?.address &&
      a.destination?.addressTag === b.destination?.addressTag &&
      a.destination?.minAmount === b.destination?.minAmount)
  );
}

export function useBinanceDepositRecipient({
  accountId,
  networkId,
  token,
  isNFT,
}: {
  accountId: string;
  networkId: string;
  token?: IToken | null;
  isNFT: boolean;
}) {
  // null from the tap until the first server answer, so the card shows at
  // once instead of waiting on the create request; undefined when the user
  // isn't sending to Binance.
  const [snapshot, setSnapshot] = useState<IBinanceDepositSnapshot | null>();
  const [isBusy, setIsBusy] = useState(false);
  const isBusyRef = useRef(false);
  // Bumped by every start, every exit and on unmount: an answer that arrives
  // for an older attempt must not open Binance.
  const attemptRef = useRef(0);
  useEffect(
    () => () => {
      attemptRef.current += 1;
    },
    [],
  );

  const isTransferAllowListEnabled = useIsEnableTransferAllowList();
  // iOS / Android only: the authorization link only works in the Binance
  // app, and only a phone gets the return deep link. Accounts that can't
  // sign, and allowlists that would block a fresh deposit address at the
  // amount step, never get the entry.
  const depositToken =
    platformEnv.isNative &&
    !isNFT &&
    !isTransferAllowListEnabled &&
    !accountUtils.isWatchingAccount({ accountId })
      ? token
      : undefined;

  // Both answers are cached so the entry is there when the page opens. A
  // token Binance doesn't accept is cached as null: the cache never stores
  // undefined, and a stale asset would flash the entry on every open.
  const { result: asset, run: refreshAsset } = usePromiseResult(
    async () =>
      depositToken
        ? ((await backgroundApiProxy.serviceBinanceDeposit.getDepositAsset({
            networkId,
            symbol: depositToken.symbol,
            contractAddress: depositToken.address,
            isNative: !!depositToken.isNative,
          })) ?? null)
        : undefined,
    [depositToken, networkId],
    {
      swrKey: depositToken
        ? `binance-deposit-asset:${networkId}:${depositToken.address || 'native'}`
        : undefined,
    },
  );
  // Asked again only when the asset comes or goes, not each time a fresh
  // copy of it arrives.
  const hasAsset = !!asset;
  const { result: isBinanceInstalled } = usePromiseResult(
    async () =>
      hasAsset ? canOpenExchangeApp(EExchangeId.Binance) : undefined,
    [hasAsset],
    { swrKey: 'binance-deposit-app-installed' },
  );

  const runExclusive = useCallback(async (task: () => Promise<void>) => {
    if (isBusyRef.current) {
      return;
    }
    isBusyRef.current = true;
    setIsBusy(true);
    try {
      await task();
    } finally {
      isBusyRef.current = false;
      setIsBusy(false);
    }
  }, []);

  const openBinance = useCallback(async (localId: string, attempt: number) => {
    try {
      // The link only lives in this local variable: it is not stored,
      // logged or put into navigation.
      const { link } =
        await backgroundApiProxy.serviceBinanceDeposit.prepareOpenLink(localId);
      if (attempt !== attemptRef.current) {
        return;
      }
      // The system has to open it: the in-app browser would not hand a
      // universal link over to the Binance app.
      await openUrlUtils.linkingOpenURL(link);
    } catch {
      Toast.error({ title: BINANCE_DEPOSIT_COPY.toastUnavailable });
    }
  }, []);

  const applyCreateResult = useCallback(
    async (attempt: number, next: IBinanceDepositSnapshot) => {
      if (attempt !== attemptRef.current) {
        return;
      }
      setSnapshot(next);
      if (next.phase === 'awaiting') {
        await openBinance(next.localId, attempt);
      }
    },
    [openBinance],
  );

  const handleCreateError = useCallback(
    async (attempt: number, error: unknown, localId?: string) => {
      if (attempt !== attemptRef.current) {
        return;
      }
      Toast.error({ title: BINANCE_DEPOSIT_COPY.toastUnavailable });
      if (
        (error as { code?: number } | undefined)?.code ===
        EBinanceDepositErrorCode.CapabilityStale
      ) {
        void refreshAsset();
      }
      const next = localId
        ? await backgroundApiProxy.serviceBinanceDeposit.getSnapshot(localId)
        : undefined;
      if (attempt !== attemptRef.current) {
        return;
      }
      setSnapshot(next);
    },
    [refreshAsset],
  );

  // Not behind the busy lock: after a cancel, the next tap must not wait for
  // the abandoned request. The service picks up an unfinished session for
  // the same asset instead of creating a second one.
  const start = useCallback(async () => {
    if (!asset) {
      return;
    }
    attemptRef.current += 1;
    const attempt = attemptRef.current;
    setSnapshot(null);
    try {
      await applyCreateResult(
        attempt,
        await backgroundApiProxy.serviceBinanceDeposit.startSession(asset),
      );
    } catch (error) {
      await handleCreateError(attempt, error);
    }
  }, [applyCreateResult, asset, handleCreateError]);

  // A retry keeps the session key of the first attempt.
  const retryCreate = useCallback(
    () =>
      runExclusive(async () => {
        if (!snapshot) {
          return;
        }
        const attempt = attemptRef.current;
        try {
          await applyCreateResult(
            attempt,
            await backgroundApiProxy.serviceBinanceDeposit.retryCreate(
              snapshot.localId,
            ),
          );
        } catch (error) {
          await handleCreateError(attempt, error, snapshot.localId);
        }
      }),
    [applyCreateResult, handleCreateError, runExclusive, snapshot],
  );

  const reopenBinance = useCallback(
    () =>
      runExclusive(async () => {
        if (snapshot) {
          await openBinance(snapshot.localId, attemptRef.current);
        }
      }),
    [openBinance, runExclusive, snapshot],
  );

  // Leaves the Binance flow; editing the recipient means a plain send. An
  // unfinished session is kept for the entry to pick up again, a failed one
  // is dropped. A start still waiting for the server is let go: its answer
  // no longer opens Binance.
  const exit = useCallback(async () => {
    attemptRef.current += 1;
    const current = snapshot;
    setSnapshot(undefined);
    if (current?.phase === 'failed') {
      await backgroundApiProxy.serviceBinanceDeposit.discardSession(
        current.localId,
      );
    }
  }, [snapshot]);

  const localId = snapshot?.localId;
  const phase = snapshot?.phase;
  useEffect(() => {
    if (!localId || phase === 'failed') {
      return;
    }
    let cancelled = false;
    const timer = setInterval(() => {
      void backgroundApiProxy.serviceBinanceDeposit.getSnapshot(localId).then(
        (next) => {
          if (cancelled) {
            return;
          }
          setSnapshot((current) => {
            if (current?.localId !== localId || isSameSnapshot(current, next)) {
              return current;
            }
            return next;
          });
        },
        () => undefined,
      );
    }, SNAPSHOT_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [localId, phase]);

  return {
    isEntryAvailable: !!asset && isBinanceInstalled === true,
    // The card takes over from the tap, before the server has answered.
    isActive: snapshot !== undefined,
    snapshot: snapshot ?? undefined,
    isBusy,
    start,
    retryCreate,
    reopenBinance,
    exit,
  };
}
