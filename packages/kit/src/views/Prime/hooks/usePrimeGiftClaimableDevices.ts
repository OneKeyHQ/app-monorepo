import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IPrimeGiftEligibilityCache } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  pickPrimeGiftCandidates,
  selectClaimable,
} from './primeGiftClaimableDevices';

import type { IPrimeGiftClaimableDevice } from './primeGiftClaimableDevices';

type IPrimeGiftCheckResult = {
  devices: IPrimeGiftClaimableDevice[];
  hasError: boolean;
  candidateCount: number;
};

export function usePrimeGiftClaimableDevices({ enabled = true } = {}) {
  const [devices, setDevices] = useState<IPrimeGiftClaimableDevice[]>();
  const [isLoading, setIsLoading] = useState(enabled);
  const [hasError, setHasError] = useState(false);
  const requestRef = useRef(0);
  const refresh = useCallback(async (): Promise<
    IPrimeGiftCheckResult | undefined
  > => {
    if (!enabled) return undefined;
    const request = requestRef.current + 1;
    requestRef.current = request;
    const isCurrent = () => requestRef.current === request;
    setIsLoading(true);
    setHasError(false);
    try {
      const wallets =
        await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
          filterQrWallet: true,
          filterHiddenWallet: true,
        });
      if (!isCurrent()) return undefined;
      const next = pickPrimeGiftCandidates(wallets);
      const eligibility: IPrimeGiftEligibilityCache = {};
      const results = await Promise.allSettled(
        next.map(async (item) => {
          const result =
            await backgroundApiProxy.servicePrime.apiGetPrimeGiftEligibility({
              serialNo: item.serialNo,
            });
          if (!isCurrent()) return;
          eligibility[item.serialNo] = result;
          setDevices(selectClaimable(next, eligibility));
        }),
      );
      if (!isCurrent()) return undefined;
      const failed = results.some((result) => result.status === 'rejected');
      const claimable = selectClaimable(next, eligibility);
      setDevices(claimable);
      setHasError(failed);
      return {
        devices: claimable,
        hasError: failed,
        candidateCount: next.length,
      };
    } catch {
      if (!isCurrent()) return undefined;
      setHasError(true);
      setDevices([]);
      return { devices: [], hasError: true, candidateCount: 0 };
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [enabled]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        requestRef.current += 1;
      };
    }, [refresh]),
  );

  useEffect(() => {
    const onRedeemed = () => {
      void refresh();
    };
    appEventBus.on(EAppEventBusNames.PrimeGiftRedeemed, onRedeemed);
    return () => {
      appEventBus.off(EAppEventBusNames.PrimeGiftRedeemed, onRedeemed);
    };
  }, [refresh]);

  return {
    devices: enabled ? devices : undefined,
    isLoading,
    hasError,
    refresh,
  };
}
