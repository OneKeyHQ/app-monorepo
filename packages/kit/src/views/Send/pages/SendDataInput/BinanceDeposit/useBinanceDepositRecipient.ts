import { useCallback, useEffect, useRef, useState } from 'react';

import { AppState } from 'react-native';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useIsEnableTransferAllowList } from '@onekeyhq/kit/src/components/AddressInput/hooks';
import { canOpenExchangeApp } from '@onekeyhq/kit/src/hooks/useExchangeAppDetection';
import { useHandleAppStateActive } from '@onekeyhq/kit/src/hooks/useHandleAppStateActive';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EExchangeId } from '@onekeyhq/shared/src/consts/exchangeConsts';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';
import {
  EBinanceDepositErrorCode,
  EBinanceDepositSessionStatus,
} from '@onekeyhq/shared/types/exchange';
import type {
  IBinanceDepositAsset,
  IBinanceDepositPhase,
  IBinanceDepositSnapshot,
} from '@onekeyhq/shared/types/exchange';
import type { IToken } from '@onekeyhq/shared/types/token';

import { BINANCE_DEPOSIT_COPY } from './binanceDepositCopy';

// Local reads only; the service asks the server at its own pace.
const SNAPSHOT_POLL_INTERVAL_MS = 1500;
// A return link arrives right after the app comes back; a session still
// waiting by then was left by the user.
const MANUAL_RETURN_CHECK_DELAY_MS = 2000;
// The switch to Binance only starts once the open resolves and takes most
// of a second; past this the app is taken to have stayed.
const OPENING_HOLD_MAX_MS = 2000;

function waitUntilAppLeaves(maxMs: number): Promise<void> {
  if (AppState.currentState === 'background') {
    return Promise.resolve();
  }
  let subscription: ReturnType<typeof AppState.addEventListener> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise<void>((resolve) => {
    subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        resolve();
      }
    });
    timer = setTimeout(resolve, maxMs);
  }).finally(() => {
    subscription?.remove();
    clearTimeout(timer);
  });
}

// The network and the coin only: never the link, the nonce or an address.
function getEventContext({
  networkId,
  cryptoCurrency,
}: Pick<IBinanceDepositAsset, 'networkId' | 'cryptoCurrency'>) {
  return { network: networkId, tokenSymbol: cryptoCurrency };
}

function getErrorCode(error: unknown): number | undefined {
  return (error as { code?: number } | undefined)?.code;
}

function getErrorToastTitle(error: unknown): string {
  switch (getErrorCode(error)) {
    case EBinanceDepositErrorCode.FeatureDisabled:
    case EBinanceDepositErrorCode.DepositDisabled:
    case EBinanceDepositErrorCode.CapabilityStale:
      return BINANCE_DEPOSIT_COPY.toastAssetUnavailable;
    case EBinanceDepositErrorCode.RateLimited:
      return BINANCE_DEPOSIT_COPY.toastRateLimited;
    default:
      return BINANCE_DEPOSIT_COPY.toastUnavailable;
  }
}

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
  // sign, allowlists that would block a fresh deposit address at the amount
  // step, and Travel Mode, which keeps no session key, never get the entry.
  const depositToken =
    platformEnv.isNative &&
    !isNFT &&
    !isTransferAllowListEnabled &&
    !accountUtils.isWatchingAccount({ accountId }) &&
    travelModeManager.getRuntimeEnvironmentSync().profile.kind !== 'travel-mode'
      ? token
      : undefined;

  // Both answers are cached so the entry is there when the page opens. A
  // token Binance doesn't accept is cached as null: the cache never stores
  // undefined, and a stale asset would flash the entry on every open. A
  // failed fetch keeps what is there.
  const {
    result: asset,
    setResult: setAsset,
    run: refreshAsset,
  } = usePromiseResult(
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
      keepResultIfError: true,
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

  // The card's button can be tapped while the open after a start is still
  // on its way; the link is opened once.
  const isOpeningRef = useRef(false);
  const [isOpening, setIsOpening] = useState(false);
  // The session Binance was last opened for, until the app comes back.
  const openedLocalIdRef = useRef<string | undefined>(undefined);
  const openBinance = useCallback(
    async (
      session: IBinanceDepositSnapshot,
      attempt: number,
      isReopen: boolean,
    ) => {
      const { localId } = session;
      if (isOpeningRef.current) {
        return;
      }
      isOpeningRef.current = true;
      setIsOpening(true);
      try {
        // The link only lives in this local variable: it is not stored,
        // logged or put into navigation.
        const { link } =
          await backgroundApiProxy.serviceBinanceDeposit.prepareOpenLink(
            localId,
          );
        if (attempt !== attemptRef.current) {
          return;
        }
        // Set first: the app may be away before the open resolves.
        openedLocalIdRef.current = localId;
        // The system has to open it: the in-app browser would not hand a
        // universal link over to the Binance app.
        await openUrlUtils.linkingOpenURL(link);
        defaultLogger.transaction.send.binanceDepositOpen({
          ...getEventContext(session),
          isReopen,
        });
        // Still opening while the system switches over: the line asking
        // whether Binance showed up is only for someone who came back.
        await waitUntilAppLeaves(OPENING_HOLD_MAX_MS);
      } catch (error) {
        openedLocalIdRef.current = undefined;
        if (attempt !== attemptRef.current) {
          return;
        }
        // An expired link fails the session, and the card then says so and
        // offers to try again: no toast on top.
        const next =
          await backgroundApiProxy.serviceBinanceDeposit.getSnapshot(localId);
        if (attempt !== attemptRef.current) {
          return;
        }
        if (next?.phase === 'failed') {
          setSnapshot((current) =>
            current?.localId === localId ? next : current,
          );
          return;
        }
        Toast.error({ title: getErrorToastTitle(error) });
      } finally {
        isOpeningRef.current = false;
        setIsOpening(false);
      }
    },
    [],
  );

  const onAppActive = useCallback(() => {
    const openedLocalId = openedLocalIdRef.current;
    openedLocalIdRef.current = undefined;
    if (!openedLocalId) {
      return;
    }
    setTimeout(() => {
      void backgroundApiProxy.serviceBinanceDeposit
        .getSnapshot(openedLocalId)
        .then(
          (next) => {
            if (next?.phase === 'awaiting') {
              defaultLogger.transaction.send.binanceDepositReturn({
                ...getEventContext(next),
                returnType: 'manual',
              });
            }
          },
          () => undefined,
        );
    }, MANUAL_RETURN_CHECK_DELAY_MS);
  }, []);
  useHandleAppStateActive(onAppActive);

  const applyCreateResult = useCallback(
    async (attempt: number, next: IBinanceDepositSnapshot) => {
      if (attempt !== attemptRef.current) {
        return;
      }
      setSnapshot(next);
      // Only a session still waiting for the authorization has a link to
      // open; a resumed one the user already confirmed has none.
      if (
        next.phase === 'awaiting' &&
        next.status === EBinanceDepositSessionStatus.INIT
      ) {
        await openBinance(next, attempt, false);
      }
    },
    [openBinance],
  );

  const handleCreateError = useCallback(
    async ({
      attempt,
      error,
      asset: failedAsset,
      localId,
    }: {
      attempt: number;
      error: unknown;
      asset: Pick<IBinanceDepositAsset, 'networkId' | 'cryptoCurrency'>;
      localId?: string;
    }) => {
      if (attempt !== attemptRef.current) {
        return;
      }
      Toast.error({ title: getErrorToastTitle(error) });
      const code = getErrorCode(error);
      defaultLogger.transaction.send.binanceDepositFail({
        ...getEventContext(failedAsset),
        reason: 'request_rejected',
        errorCode: code,
      });
      if (code === EBinanceDepositErrorCode.CapabilityStale) {
        void refreshAsset();
      } else if (
        code === EBinanceDepositErrorCode.FeatureDisabled ||
        code === EBinanceDepositErrorCode.DepositDisabled
      ) {
        // Turned off by Binance for now: the entry goes away on this page,
        // and the next list fetched decides when it comes back.
        setAsset(null);
      }
      const next = localId
        ? await backgroundApiProxy.serviceBinanceDeposit.getSnapshot(localId)
        : undefined;
      if (attempt !== attemptRef.current) {
        return;
      }
      setSnapshot(next);
    },
    [refreshAsset, setAsset],
  );

  // A start that picks up an address already released only waits for the
  // server to confirm it: the card says it is getting the address rather
  // than opening Binance.
  const [isResuming, setIsResuming] = useState(false);

  // Not behind the busy lock: after a cancel the card must come back at
  // once. The service runs starts one after another and picks up the
  // unfinished session, so this tap gets the answer of a create still
  // running.
  const start = useCallback(
    async (trigger: 'entry' | 'tryAgain') => {
      if (!asset) {
        return;
      }
      defaultLogger.transaction.send.binanceDepositStart({
        ...getEventContext(asset),
        trigger,
      });
      attemptRef.current += 1;
      const attempt = attemptRef.current;
      // A local read, asked before the card shows so it opens with the
      // right line.
      const resuming = await backgroundApiProxy.serviceBinanceDeposit
        .hasResumableAddress(asset)
        .catch(() => false);
      if (attempt !== attemptRef.current) {
        return;
      }
      setIsResuming(resuming);
      setSnapshot(null);
      try {
        await applyCreateResult(
          attempt,
          await backgroundApiProxy.serviceBinanceDeposit.startSession(asset),
        );
      } catch (error) {
        await handleCreateError({ attempt, error, asset });
      }
    },
    [applyCreateResult, asset, handleCreateError],
  );

  // A retry keeps the session key of the first attempt.
  const retryCreate = useCallback(
    () =>
      runExclusive(async () => {
        if (!snapshot) {
          return;
        }
        const attempt = attemptRef.current;
        defaultLogger.transaction.send.binanceDepositStart({
          ...getEventContext(snapshot),
          trigger: 'tryAgain',
        });
        try {
          await applyCreateResult(
            attempt,
            await backgroundApiProxy.serviceBinanceDeposit.retryCreate(
              snapshot.localId,
            ),
          );
        } catch (error) {
          await handleCreateError({
            attempt,
            error,
            asset: snapshot,
            localId: snapshot.localId,
          });
        }
      }),
    [applyCreateResult, handleCreateError, runExclusive, snapshot],
  );

  const reopenBinance = useCallback(
    () =>
      runExclusive(async () => {
        if (snapshot) {
          await openBinance(snapshot, attemptRef.current, true);
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

  const isEntryAvailable = !!asset && isBinanceInstalled === true;
  // Once per page for each asset, however often typing hides the entry.
  const shownAssetKeyRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const key = asset ? `${asset.networkId}:${asset.cryptoCurrency}` : '';
    if (!asset || !isEntryAvailable || shownAssetKeyRef.current === key) {
      return;
    }
    shownAssetKeyRef.current = key;
    defaultLogger.transaction.send.binanceDepositEntryShow(
      getEventContext(asset),
    );
  }, [asset, isEntryAvailable]);

  // Each state a session reaches is reported once. A session that already
  // has its address when it first shows here was picked up again.
  const reportedRef = useRef<{
    localId?: string;
    phase?: IBinanceDepositPhase;
    isUnbound?: boolean;
  }>({});
  useEffect(() => {
    if (!snapshot) {
      return;
    }
    const last = reportedRef.current;
    const isSameSession = last.localId === snapshot.localId;
    const isUnbound =
      snapshot.status === EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND;
    reportedRef.current = {
      localId: snapshot.localId,
      phase: snapshot.phase,
      isUnbound,
    };
    const context = getEventContext(snapshot);
    if (isUnbound && !(isSameSession && last.isUnbound)) {
      defaultLogger.transaction.send.binanceDepositNotReturned(context);
    }
    if (isSameSession && last.phase === snapshot.phase) {
      return;
    }
    if (snapshot.phase === 'authorized') {
      defaultLogger.transaction.send.binanceDepositAddressReceived({
        ...context,
        isResumed: !isSameSession,
      });
    } else if (
      snapshot.phase === 'failed' ||
      snapshot.phase === 'create_failed'
    ) {
      defaultLogger.transaction.send.binanceDepositFail({
        ...context,
        reason: snapshot.failReason ?? 'create_failed',
      });
    }
  }, [snapshot]);

  return {
    isEntryAvailable,
    // The card takes over from the tap, before the server has answered.
    isActive: snapshot !== undefined,
    snapshot: snapshot ?? undefined,
    isBusy,
    // Binance is being opened; the card holds its opening state till then.
    isOpening,
    isResuming,
    start,
    retryCreate,
    reopenBinance,
    exit,
  };
}
