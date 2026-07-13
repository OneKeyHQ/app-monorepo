import { getDesktopOfflineChartReady } from '../utils/desktopOfflineChartReady';

export const CHART_MIGRATION_EXPORT_MIN_RETRY_INTERVAL_MS = 60 * 1000;
export const CHART_MIGRATION_EXPORT_TIMEOUT_MS = 30 * 1000;
export const CHART_MIGRATION_RESTORE_ACK_TIMEOUT_MS = 30 * 1000;
export const CHART_MIGRATION_RESTORE_MAX_ATTEMPTS = 3;
export const CHART_MIGRATION_RESTORE_RETRY_DELAY_MS = 1000;

export const CHART_MIGRATION_KEY_PREFIX = 'tradingview';

export const CHART_MIGRATION_EXPORT_EVAL_JS = `
(function () {
  try {
    var items = {};
    for (var i = 0; i < window.localStorage.length; i += 1) {
      var k = window.localStorage.key(i);
      if (k && k.indexOf('${CHART_MIGRATION_KEY_PREFIX}') === 0) {
        items[k] = window.localStorage.getItem(k) || '';
      }
    }
    return JSON.stringify(items);
  } catch (e) {
    return '{}';
  }
})();
`;

let requestIdSeq = 0;

export function nextChartMigrationRequestId(): string {
  requestIdSeq += 1;
  return `chart-migration-restore-${Date.now()}-${requestIdSeq}`;
}

export function isChartMigrationEffectivelyOffline(): boolean {
  return getDesktopOfflineChartReady();
}

export function buildRestoreStorageMessage(params: {
  requestId: string;
  items: Record<string, string>;
}) {
  return {
    type: 'RESTORE_STORAGE',
    requestId: params.requestId,
    payload: {
      version: 1,
      items: Object.entries(params.items).map(([key, value]) => ({
        key,
        value,
      })),
    },
  };
}

export type IChartMigrationRestoreAck = {
  scope: '$private';
  method: 'tradingview_restoreStorageResult';
  data: {
    requestId?: string;
    ok?: boolean;
    restoredCount?: number;
    skippedKeys?: string[];
    error?: string;
  };
};

export function parseRestoreAck(
  payload: unknown,
): IChartMigrationRestoreAck['data'] | undefined {
  const wrappedData = (payload as { data?: unknown })?.data;
  const data = (
    wrappedData && typeof wrappedData === 'object' && 'method' in wrappedData
      ? wrappedData
      : payload
  ) as IChartMigrationRestoreAck | undefined;
  if (
    data &&
    data.scope === '$private' &&
    data.method === 'tradingview_restoreStorageResult'
  ) {
    return data.data;
  }
  return undefined;
}
