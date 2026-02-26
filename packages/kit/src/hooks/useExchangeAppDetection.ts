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
  const sortedExchanges = useMemo(
    (): IExchangeConfig[] => ALL_EXCHANGE_IDS.map((id) => EXCHANGE_CONFIGS[id]),
    [],
  );

  const isExchangeInstalled = useCallback(
    (_exchangeId: EExchangeId): boolean => false,
    [],
  );

  const openExchangeApp = useCallback(
    async (_exchangeId: EExchangeId): Promise<void> => {},
    [],
  );

  return {
    isDetecting: false,
    installedStatus: initialInstalledStatus,
    sortedExchanges,
    isExchangeInstalled,
    openExchangeApp,
  };
}
