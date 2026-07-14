import {
  CHART_MIGRATION_RESTORE_MIN_RETRY_INTERVAL_MS,
  type IChartMigrationExportResult,
  getChartMigrationRestoreRetryDelayMs,
  mergeChartMigrationExportResults,
  parseChartMigrationExportResult,
} from './utils';

describe('parseChartMigrationExportResult', () => {
  it('parses a successful storage export', () => {
    expect(
      parseChartMigrationExportResult(
        JSON.stringify({
          ok: true,
          items: { tradingview_layout: 'saved-layout' },
        }),
      ),
    ).toEqual({
      ok: true,
      items: { tradingview_layout: 'saved-layout' },
    });
  });

  it.each([
    JSON.stringify({ ok: false }),
    JSON.stringify({ ok: true, items: { tradingview_layout: 1 } }),
    'not-json',
  ])('rejects a failed or malformed storage export', (raw) => {
    expect(parseChartMigrationExportResult(raw)).toEqual({ ok: false });
  });
});

describe('mergeChartMigrationExportResults', () => {
  it('merges all successful origins in priority order', () => {
    const results = new Map<string, IChartMigrationExportResult>([
      ['prod', { ok: true as const, items: { shared: 'prod', prod: '1' } }],
      ['test', { ok: true as const, items: { shared: 'test', test: '1' } }],
    ]);

    expect(
      mergeChartMigrationExportResults({
        results,
        mergeOrder: ['prod', 'test'],
      }),
    ).toEqual({
      ok: true,
      items: { shared: 'test', prod: '1', test: '1' },
    });
  });

  it('rejects the whole export when any origin fails', () => {
    const results = new Map<string, IChartMigrationExportResult>([
      ['prod', { ok: true as const, items: { tradingview_layout: 'prod' } }],
      ['test', { ok: false as const }],
    ]);

    expect(
      mergeChartMigrationExportResults({
        results,
        mergeOrder: ['prod', 'test'],
      }),
    ).toEqual({ ok: false });
  });
});

describe('getChartMigrationRestoreRetryDelayMs', () => {
  it('does not delay the first restore attempt', () => {
    expect(getChartMigrationRestoreRetryDelayMs(undefined, 100_000)).toBe(0);
  });

  it('waits for the remaining cross-launch retry interval', () => {
    const now = 100_000;
    const elapsed = 5000;
    expect(getChartMigrationRestoreRetryDelayMs(now - elapsed, now)).toBe(
      CHART_MIGRATION_RESTORE_MIN_RETRY_INTERVAL_MS - elapsed,
    );
  });

  it('retries immediately after the interval has elapsed', () => {
    const now = 100_000;
    expect(
      getChartMigrationRestoreRetryDelayMs(
        now - CHART_MIGRATION_RESTORE_MIN_RETRY_INTERVAL_MS,
        now,
      ),
    ).toBe(0);
  });

  it('caps delay when the system clock moves backwards', () => {
    expect(getChartMigrationRestoreRetryDelayMs(110_000, 100_000)).toBe(
      CHART_MIGRATION_RESTORE_MIN_RETRY_INTERVAL_MS,
    );
  });
});
