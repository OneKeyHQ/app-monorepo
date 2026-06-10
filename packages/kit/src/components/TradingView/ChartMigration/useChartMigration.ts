import { useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ITradingViewChartMigration } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAppStatus';
import { useChartBootSnapshotReady } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  CHART_MIGRATION_EXPORT_MIN_RETRY_INTERVAL_MS,
  isChartMigrationEffectivelyOffline,
} from './utils';

export type IChartMigrationPhase = 'idle' | 'export' | 'restore';

/**
 * Resolve which migration phase (if any) this launch should drive.
 *
 * Reads the SimpleDB migration state ONCE the cold-start chart-mode snapshot is
 * ready (Gate 2 barrier — the state was seeded earlier in
 * `ServiceBootstrap.initCritical`). The phase is then locked for the session:
 *
 *   - `export`  : effective mode offline + state === 'export-deferred' and the
 *                 backoff window has elapsed → dump the OLD origin once.
 *   - `restore` : effective mode offline + state === 'restore-pending' → inject
 *                 the exported blob into the offline chart.
 *   - `idle`    : nothing to do (online mode, unsupported platform,
 *                 done/empty/skipped, or backoff not elapsed yet).
 */
export function useChartMigration(): {
  phase: IChartMigrationPhase;
  blob: Record<string, string> | undefined;
} {
  const bootReady = useChartBootSnapshotReady();
  const [phase, setPhase] = useState<IChartMigrationPhase>('idle');
  const [blob, setBlob] = useState<Record<string, string> | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!bootReady) {
      return;
    }
    // Only the offline path migrates; the online path keeps data on the old
    // origin. Also gates on iOS/Desktop via isChartMigrationEffectivelyOffline.
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
        // Backoff: at most one export attempt per launch + a minimum interval
        // since the last attempt. Never permanently skip (no attempts cap).
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
        setPhase('restore');
      }
      // done / export-empty / skipped-first-install → stay idle.
    })();
    return () => {
      cancelled = true;
    };
    // Run once when the boot barrier flips ready; the phase is session-locked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootReady]);

  return { phase, blob };
}
