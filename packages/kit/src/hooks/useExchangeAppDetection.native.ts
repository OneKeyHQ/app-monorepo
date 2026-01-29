/**
 * Exchange app detection hook - Native implementation (iOS/Android)
 *
 * This uses expo-linking to detect installed exchange apps
 * and provides deep link functionality to open them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ALL_EXCHANGE_IDS,
  type EExchangeId,
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

  // Detect installed apps on mount
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
              config.deepLinkScheme,
            );
            results[id] = canOpen;
          } catch {
            results[id] = false;
          }
        }),
      );

      setInstalledStatus(results);
      setIsDetecting(false);
    };

    void detectApps();
  }, []);

  // Sort exchanges: installed apps first, then uninstalled
  const sortedExchanges = useMemo((): IExchangeConfig[] => {
    const installed: IExchangeConfig[] = [];
    const notInstalled: IExchangeConfig[] = [];

    for (const id of ALL_EXCHANGE_IDS) {
      const config = EXCHANGE_CONFIGS[id];
      if (installedStatus[id]) {
        installed.push(config);
      } else {
        notInstalled.push(config);
      }
    }

    return [...installed, ...notInstalled];
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
    /** Whether detection is still in progress */
    isDetecting,
    /** Installation status for each exchange */
    installedStatus,
    /** Exchanges sorted with installed apps first */
    sortedExchanges,
    /** Check if a specific exchange is installed */
    isExchangeInstalled,
    /** Open exchange app via deep link */
    openExchangeApp,
  };
}
