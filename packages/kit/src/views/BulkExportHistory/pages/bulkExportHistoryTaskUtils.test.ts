import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  formatExportHistoryTaskFilenameDay,
  formatExportHistoryTaskTimeZone,
  getExportHistoryTaskDisplayStatus,
  getExportHistoryTaskStatusMeta,
  isExportHistoryTaskDownloadable,
  isExportHistoryTaskInProgress,
} from './bulkExportHistoryTaskUtils';

describe('bulkExportHistoryTaskUtils', () => {
  it.each([
    [{ status: 'pending' as const, next: null }, 'queued'],
    [{ status: 'processing' as const, next: null }, 'processing'],
    [{ status: 'success' as const, next: null }, 'ready'],
    [{ status: 'success' as const, next: undefined }, 'ready'],
    [{ status: 'success' as const, next: 0 }, 'partial'],
    [{ status: 'failed' as const, next: null }, 'failed'],
    [{ status: 'deprecated' as const, next: null }, 'expired'],
  ])('maps %o to %s', (task, expected) => {
    expect(getExportHistoryTaskDisplayStatus(task)).toBe(expected);
  });

  it('allows ready and partial exports to be downloaded', () => {
    expect(isExportHistoryTaskDownloadable('ready')).toBe(true);
    expect(isExportHistoryTaskDownloadable('partial')).toBe(true);
    expect(isExportHistoryTaskDownloadable('processing')).toBe(false);
    expect(isExportHistoryTaskDownloadable('failed')).toBe(false);
  });

  it('treats queued and processing exports as in progress', () => {
    expect(isExportHistoryTaskInProgress('queued')).toBe(true);
    expect(isExportHistoryTaskInProgress('processing')).toBe(true);
    expect(isExportHistoryTaskInProgress('ready')).toBe(false);
    expect(isExportHistoryTaskInProgress('failed')).toBe(false);
  });

  it('provides consistent presentation metadata for partial exports', () => {
    expect(
      getExportHistoryTaskStatusMeta({ status: 'success', next: 100 }),
    ).toMatchObject({
      displayStatus: 'partial',
      statusIndicatorColor: '$textCaution',
      statusTextColor: '$textCaution',
      isInProgress: false,
      isDownloadable: true,
    });
  });

  it('provides consistent presentation metadata for processing exports', () => {
    expect(
      getExportHistoryTaskStatusMeta({ status: 'processing', next: null }),
    ).toMatchObject({
      displayStatus: 'processing',
      statusIndicatorColor: '$textSubdued',
      statusTextColor: '$textSubdued',
      isInProgress: true,
      isDownloadable: false,
    });
  });

  it('only uses strong status text colors for attention states', () => {
    expect(
      getExportHistoryTaskStatusMeta({ status: 'pending', next: null })
        .statusTextColor,
    ).toBe('$textSubdued');
    expect(
      getExportHistoryTaskStatusMeta({ status: 'processing', next: null })
        .statusTextColor,
    ).toBe('$textSubdued');
    expect(
      getExportHistoryTaskStatusMeta({ status: 'success', next: null })
        .statusTextColor,
    ).toBe('$textSubdued');
    expect(
      getExportHistoryTaskStatusMeta({ status: 'success', next: 100 })
        .statusTextColor,
    ).toBe('$textCaution');
    expect(
      getExportHistoryTaskStatusMeta({ status: 'failed', next: null })
        .statusTextColor,
    ).toBe('$textCritical');
  });

  it('uses export-specific copy for the expired status', () => {
    expect(
      getExportHistoryTaskStatusMeta({ status: 'deprecated', next: null })
        .labelId,
    ).toBe(ETranslations.export_history_expired__title);
  });

  it.each([
    ['+08:00', 'UTC+08:00'],
    ['-05:00', 'UTC-05:00'],
    ['Asia/Shanghai', 'Asia/Shanghai'],
    [undefined, undefined],
  ])('formats the time zone %s as %s', (timeZone, expected) => {
    expect(formatExportHistoryTaskTimeZone(timeZone)).toBe(expected);
  });

  it('formats export dates in the time zone saved with the task', () => {
    const timestampMs = Date.UTC(2026, 5, 30, 16, 30);

    expect(formatExportHistoryTaskFilenameDay(timestampMs, '+08:00')).toBe(
      '010726',
    );
    expect(formatExportHistoryTaskFilenameDay(timestampMs, '-05:00')).toBe(
      '300626',
    );
    expect(
      formatExportHistoryTaskFilenameDay(timestampMs, 'Asia/Shanghai'),
    ).toBe('010726');
  });
});
