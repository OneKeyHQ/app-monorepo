/**
 * Exchange app detection hook - Default implementation (non-native platforms)
 *
 * On Desktop/Web/Extension, we don't detect app installation.
 * This returns static data without any native dependencies.
 */
import { useCallback, useMemo } from 'react';

import {
  ALL_EXCHANGE_IDS,
  type EExchangeId,
  EXCHANGE_CONFIGS,
  type IExchangeConfig,
} from '@onekeyhq/shared/src/consts/exchangeConsts';

type IInstalledStatus = Record<EExchangeId, boolean>;

const initialInstalledStatus: IInstalledStatus = ALL_EXCHANGE_IDS.reduce(
  (acc, id) => {
    acc[id] = false;
    return acc;
  },
  {} as IInstalledStatus,
);

export function useExchangeAppDetection() {
  // On non-native platforms, exchanges are always "not installed"
  const sortedExchanges = useMemo(
    (): IExchangeConfig[] => ALL_EXCHANGE_IDS.map((id) => EXCHANGE_CONFIGS[id]),
    [],
  );

  const isExchangeInstalled = useCallback(
    (_exchangeId: EExchangeId): boolean => false,
    [],
  );

  const openExchangeApp = useCallback(
    async (_exchangeId: EExchangeId): Promise<void> => {
      // No-op on non-native platforms
    },
    [],
  );

  return {
    /** Whether detection is still in progress */
    isDetecting: false,
    /** Installation status for each exchange */
    installedStatus: initialInstalledStatus,
    /** Exchanges sorted with installed apps first */
    sortedExchanges,
    /** Check if a specific exchange is installed */
    isExchangeInstalled,
    /** Open exchange app via deep link */
    openExchangeApp,
  };
}
