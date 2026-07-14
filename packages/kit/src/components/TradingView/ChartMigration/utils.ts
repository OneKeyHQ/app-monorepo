export const CHART_MIGRATION_EXPORT_MIN_RETRY_INTERVAL_MS = 60 * 1000;
export const CHART_MIGRATION_EXPORT_TIMEOUT_MS = 30 * 1000;
export const CHART_MIGRATION_RESTORE_ACK_TIMEOUT_MS = 30 * 1000;
export const CHART_MIGRATION_RESTORE_MAX_SESSION_ATTEMPTS = 3;
export const CHART_MIGRATION_RESTORE_RETRY_DELAY_MS = 1000;
export const CHART_MIGRATION_RESTORE_MIN_RETRY_INTERVAL_MS = 30 * 1000;

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
    return JSON.stringify({ ok: true, items: items });
  } catch (e) {
    return JSON.stringify({ ok: false });
  }
})();
`;

export type IChartMigrationExportResult =
  | { ok: true; items: Record<string, string> }
  | { ok: false };

export function parseChartMigrationExportResult(
  raw: unknown,
): IChartMigrationExportResult {
  try {
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false };
    }
    const result = parsed as { ok?: unknown; items?: unknown };
    if (
      result.ok !== true ||
      !result.items ||
      typeof result.items !== 'object' ||
      Array.isArray(result.items)
    ) {
      return { ok: false };
    }

    const items: Record<string, string> = {};
    for (const [key, value] of Object.entries(result.items)) {
      if (typeof value !== 'string') {
        return { ok: false };
      }
      items[key] = value;
    }
    return { ok: true, items };
  } catch {
    return { ok: false };
  }
}

export function mergeChartMigrationExportResults(params: {
  results: ReadonlyMap<string, IChartMigrationExportResult>;
  mergeOrder: readonly string[];
}): IChartMigrationExportResult {
  const items: Record<string, string> = {};
  for (const sourceUrl of params.mergeOrder) {
    const sourceResult = params.results.get(sourceUrl);
    if (!sourceResult?.ok) {
      return { ok: false };
    }
    Object.assign(items, sourceResult.items);
  }
  return { ok: true, items };
}

let requestIdSeq = 0;

export function nextChartMigrationRequestId(): string {
  requestIdSeq += 1;
  return `chart-migration-restore-${Date.now()}-${requestIdSeq}`;
}

export function getChartMigrationRestoreRetryDelayMs(
  lastRestoreAttemptAt: number | undefined,
  now = Date.now(),
): number {
  if (!lastRestoreAttemptAt) {
    return 0;
  }
  const elapsedMs = Math.max(0, now - lastRestoreAttemptAt);
  return Math.max(0, CHART_MIGRATION_RESTORE_MIN_RETRY_INTERVAL_MS - elapsedMs);
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
