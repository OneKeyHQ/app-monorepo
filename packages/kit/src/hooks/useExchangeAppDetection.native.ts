import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ALL_EXCHANGE_IDS,
  EExchangeId,
  EXCHANGE_CONFIGS,
  type IExchangeConfig,
} from '@onekeyhq/shared/src/consts/exchangeConsts';
import openUrlUtils from '@onekeyhq/shared/src/utils/openUrlUtils';

type IInstalledStatus = Record<EExchangeId, boolean>;

const initialInstalledStatus: IInstalledStatus = ALL_EXCHANGE_IDS.reduce(
  (acc, id) => {
    acc[id] = false;
    return acc;
  },
  {} as IInstalledStatus,
);

export function useExchangeAppDetection() {
  const [installedStatus, setInstalledStatus] = useState<IInstalledStatus>(
    initialInstalledStatus,
  );
  const [isDetecting, setIsDetecting] = useState(true);
  const hasDetectedRef = useRef(false);

  useEffect(() => {
    if (hasDetectedRef.current) {
      return;
    }
    hasDetectedRef.current = true;

    const detectApps = async () => {
      const results: IInstalledStatus = { ...initialInstalledStatus };

      await Promise.all(
        ALL_EXCHANGE_IDS.map(async (id) => {
          const config = EXCHANGE_CONFIGS[id];
          try {
            const canOpen = await openUrlUtils.linkingCanOpenURL(
              config.detectionUrl ?? config.appOpenUrl,
            );
            results[id] = canOpen;
          } catch (_e) {
            results[id] = false;
          }
        }),
      );

      setInstalledStatus(results);
      setIsDetecting(false);
    };

    void detectApps();
  }, []);

  const sortedExchanges = useMemo((): IExchangeConfig[] => {
    const binanceConfig = EXCHANGE_CONFIGS[EExchangeId.Binance];
    const isBinanceInstalled = installedStatus[EExchangeId.Binance];

    const otherIds = ALL_EXCHANGE_IDS.filter(
      (id) => id !== EExchangeId.Binance,
    );
    const otherInstalled = otherIds
      .filter((id) => installedStatus[id])
      .map((id) => EXCHANGE_CONFIGS[id]);
    const otherNotInstalled = otherIds
      .filter((id) => !installedStatus[id])
      .map((id) => EXCHANGE_CONFIGS[id]);

    if (isBinanceInstalled) {
      return [binanceConfig, ...otherInstalled, ...otherNotInstalled];
    }
    return [...otherInstalled, binanceConfig, ...otherNotInstalled];
  }, [installedStatus]);

  const isExchangeInstalled = useCallback(
    (exchangeId: EExchangeId): boolean => installedStatus[exchangeId] ?? false,
    [installedStatus],
  );

  const openExchangeApp = useCallback(
    async (exchangeId: EExchangeId): Promise<void> => {
      const config = EXCHANGE_CONFIGS[exchangeId];
      if (!config) {
        return;
      }

      try {
        await openUrlUtils.linkingOpenURL(config.appOpenUrl);
      } catch {
        // If specific app URL fails, try the scheme directly
        try {
          await openUrlUtils.linkingOpenURL(config.deepLinkScheme);
        } catch {
          // Silently fail if unable to open
        }
      }
    },
    [],
  );

  return {
    isDetecting,
    installedStatus,
    sortedExchanges,
    isExchangeInstalled,
    openExchangeApp,
  };
}
