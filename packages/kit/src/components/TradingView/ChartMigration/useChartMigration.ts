import { useCallback, useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ITradingViewChartMigration } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAppStatus';

import { useDesktopOfflineChartReady } from '../utils/desktopOfflineChartReady';

import {
  CHART_MIGRATION_EXPORT_MIN_RETRY_INTERVAL_MS,
  getChartMigrationRestoreRetryDelayMs,
} from './utils';

export type IChartMigrationPhase = 'idle' | 'export' | 'restore';

export function useChartMigration(): {
  phase: IChartMigrationPhase;
  blob: Record<string, string> | undefined;
  restoreAttemptCount: number;
  handleExported: (items: Record<string, string>) => void;
  handleRestored: () => void;
} {
  const [phase, setPhase] = useState<IChartMigrationPhase>('idle');
  const [blob, setBlob] = useState<Record<string, string> | undefined>();
  const [restoreAttemptCount, setRestoreAttemptCount] = useState(0);
  const isDesktopOfflineChartReady = useDesktopOfflineChartReady();

  useEffect(() => {
    if (!isDesktopOfflineChartReady) {
      return;
    }

    let cancelled = false;
    let restoreRetryTimer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const { migration, blob: storedBlob } =
        await backgroundApiProxy.serviceApp.getTradingViewChartMigration();
      if (cancelled) {
        return;
      }

      const state: ITradingViewChartMigration['state'] | undefined =
        migration?.state;
      if (state === 'export-deferred') {
        const lastAttemptAt = migration?.lastAttemptAt ?? 0;
        if (
          Date.now() - lastAttemptAt <
          CHART_MIGRATION_EXPORT_MIN_RETRY_INTERVAL_MS
        ) {
          return;
        }
        setPhase('export');
      } else if (state === 'restore-pending') {
        const startRestore = () => {
          if (cancelled) {
            return;
          }
          setBlob(storedBlob);
          setRestoreAttemptCount(migration?.restoreAttemptCount ?? 0);
          setPhase(storedBlob ? 'restore' : 'idle');
        };
        const retryDelayMs = getChartMigrationRestoreRetryDelayMs(
          migration?.lastRestoreAttemptAt,
        );
        if (retryDelayMs > 0) {
          restoreRetryTimer = setTimeout(startRestore, retryDelayMs);
        } else {
          startRestore();
        }
      }
    })();

    return () => {
      cancelled = true;
      if (restoreRetryTimer) {
        clearTimeout(restoreRetryTimer);
      }
    };
  }, [isDesktopOfflineChartReady]);

  const handleExported = useCallback((items: Record<string, string>) => {
    if (Object.keys(items).length === 0) {
      setBlob(undefined);
      setPhase('idle');
      return;
    }
    setBlob(items);
    setRestoreAttemptCount(0);
    setPhase('restore');
  }, []);

  const handleRestored = useCallback(() => {
    setBlob(undefined);
    setRestoreAttemptCount(0);
    setPhase('idle');
  }, []);

  return {
    phase,
    blob,
    restoreAttemptCount,
    handleExported,
    handleRestored,
  };
}
