import { useCallback, useEffect, useRef, useState } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EBinanceDepositErrorCode } from '@onekeyhq/shared/types/exchange';
import type { IBinanceDepositSnapshot } from '@onekeyhq/shared/types/exchange';
import type { IToken } from '@onekeyhq/shared/types/token';

import { BINANCE_DEPOSIT_COPY } from './binanceDepositCopy';

// Local reads only; the service asks the server at its own pace.
const SNAPSHOT_POLL_INTERVAL_MS = 1500;

function getErrorText(error: unknown): string {
  switch ((error as { code?: number } | undefined)?.code) {
    case EBinanceDepositErrorCode.FeatureDisabled:
    case EBinanceDepositErrorCode.DepositDisabled:
      return BINANCE_DEPOSIT_COPY.toastUnavailable;
    case EBinanceDepositErrorCode.RateLimited:
      return BINANCE_DEPOSIT_COPY.toastRateLimited;
    case EBinanceDepositErrorCode.CapabilityStale:
      return BINANCE_DEPOSIT_COPY.toastAssetUnavailable;
    default:
      return BINANCE_DEPOSIT_COPY.toastRequestFailed;
  }
}

function isSameSnapshot(
  a: IBinanceDepositSnapshot | undefined,
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
  networkId,
  token,
  isNFT,
}: {
  networkId: string;
  token?: IToken | null;
  isNFT: boolean;
}) {
  const [snapshot, setSnapshot] = useState<IBinanceDepositSnapshot>();
  const [isBusy, setIsBusy] = useState(false);
  const isBusyRef = useRef(false);

  // iOS / Android only: the authorization link only works in the Binance
  // app, and only a phone gets the return deep link.
  const { result: asset, run: refreshAsset } = usePromiseResult(async () => {
    if (!platformEnv.isNative || isNFT || !token) {
      return undefined;
    }
    return backgroundApiProxy.serviceBinanceDeposit.getDepositAsset({
      networkId,
      symbol: token.symbol,
      contractAddress: token.address,
      isNative: !!token.isNative,
    });
  }, [isNFT, networkId, token]);

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

  const openBinance = useCallback(async (localId: string) => {
    try {
      // The link only lives in this local variable: it is not stored,
      // logged or put into navigation.
      const { link } =
        await backgroundApiProxy.serviceBinanceDeposit.prepareOpenLink(localId);
      // The system has to open it: the in-app browser would not hand a
      // universal link over to the Binance app.
      await openUrlUtils.linkingOpenURL(link);
    } catch {
      Toast.error({ title: BINANCE_DEPOSIT_COPY.toastOpenFailed });
    }
  }, []);

  const applyCreateResult = useCallback(
    async (next: IBinanceDepositSnapshot) => {
      setSnapshot(next);
      if (next.phase === 'awaiting') {
        await openBinance(next.localId);
      }
    },
    [openBinance],
  );

  const handleCreateError = useCallback(
    async (error: unknown, localId?: string) => {
      Toast.error({ title: getErrorText(error) });
      if (
        (error as { code?: number } | undefined)?.code ===
        EBinanceDepositErrorCode.CapabilityStale
      ) {
        void refreshAsset();
      }
      setSnapshot(
        localId
          ? await backgroundApiProxy.serviceBinanceDeposit.getSnapshot(localId)
          : undefined,
      );
    },
    [refreshAsset],
  );

  const start = useCallback(
    () =>
      runExclusive(async () => {
        if (!asset) {
          return;
        }
        try {
          await applyCreateResult(
            await backgroundApiProxy.serviceBinanceDeposit.startSession(asset),
          );
        } catch (error) {
          await handleCreateError(error);
        }
      }),
    [applyCreateResult, asset, handleCreateError, runExclusive],
  );

  // A retry keeps the session key of the first attempt.
  const retryCreate = useCallback(
    () =>
      runExclusive(async () => {
        if (!snapshot) {
          return;
        }
        try {
          await applyCreateResult(
            await backgroundApiProxy.serviceBinanceDeposit.retryCreate(
              snapshot.localId,
            ),
          );
        } catch (error) {
          await handleCreateError(error, snapshot.localId);
        }
      }),
    [applyCreateResult, handleCreateError, runExclusive, snapshot],
  );

  const reopenBinance = useCallback(
    () =>
      runExclusive(async () => {
        if (snapshot) {
          await openBinance(snapshot.localId);
        }
      }),
    [openBinance, runExclusive, snapshot],
  );

  // Leaves the Binance flow; editing the recipient means a plain send. An
  // unfinished session is kept for the entry to pick up again, a failed one
  // is dropped.
  const exit = useCallback(async () => {
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
    asset,
    snapshot,
    isBusy,
    start,
    retryCreate,
    reopenBinance,
    exit,
  };
}
