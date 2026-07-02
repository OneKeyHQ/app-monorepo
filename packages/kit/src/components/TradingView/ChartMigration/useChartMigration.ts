import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ITradingViewChartMigration } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAppStatus';

import {
  CHART_MIGRATION_EXPORT_MIN_RETRY_INTERVAL_MS,
  isChartMigrationEffectivelyOffline,
} from './utils';

export type IChartMigrationPhase = 'idle' | 'export' | 'restore';

export function useChartMigration(): {
  phase: IChartMigrationPhase;
  blob: Record<string, string> | undefined;
} {
  const [phase, setPhase] = useState<IChartMigrationPhase>('idle');
  const [blob, setBlob] = useState<Record<string, string> | undefined>();

  useEffect(() => {
    if (!isChartMigrationEffectivelyOffline()) {
      return;
    }

    let cancelled = false;
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
        setBlob(storedBlob);
        setPhase(storedBlob ? 'restore' : 'idle');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { phase, blob };
}
