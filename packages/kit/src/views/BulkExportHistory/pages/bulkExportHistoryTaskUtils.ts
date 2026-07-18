import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IExportTransactionHistoryTask } from '@onekeyhq/shared/types/history';

export type IExportHistoryTaskDisplayStatus =
  | 'queued'
  | 'processing'
  | 'ready'
  | 'partial'
  | 'failed'
  | 'expired';

export type IExportHistoryTaskStatusMeta = {
  displayStatus: IExportHistoryTaskDisplayStatus;
  statusIndicatorColor:
    | '$textSuccess'
    | '$textCaution'
    | '$textCritical'
    | '$textSubdued';
  statusTextColor: '$textCaution' | '$textCritical' | '$textSubdued';
  labelId: ETranslations;
  descriptionId?: ETranslations;
  descriptionColor: '$textCaution' | '$textCritical' | '$textSubdued';
  isInProgress: boolean;
  isDownloadable: boolean;
};

export function getExportHistoryTaskDisplayStatus({
  status,
  next,
}: Pick<IExportTransactionHistoryTask, 'status'> & {
  next?: IExportTransactionHistoryTask['next'];
}): IExportHistoryTaskDisplayStatus {
  switch (status) {
    case 'pending':
      return 'queued';
    case 'processing':
      return 'processing';
    case 'success':
      return next === null || next === undefined ? 'ready' : 'partial';
    case 'failed':
      return 'failed';
    case 'deprecated':
      return 'expired';
    default:
      return 'failed';
  }
}

export function isExportHistoryTaskDownloadable(
  status: IExportHistoryTaskDisplayStatus,
) {
  return status === 'ready' || status === 'partial';
}

export function isExportHistoryTaskInProgress(
  status: IExportHistoryTaskDisplayStatus,
) {
  return status === 'queued' || status === 'processing';
}

export function getExportHistoryTaskStatusMeta(
  task: Pick<IExportTransactionHistoryTask, 'status' | 'next'>,
): IExportHistoryTaskStatusMeta {
  const displayStatus = getExportHistoryTaskDisplayStatus(task);
  const common = {
    displayStatus,
    isInProgress: isExportHistoryTaskInProgress(displayStatus),
    isDownloadable: isExportHistoryTaskDownloadable(displayStatus),
  };

  switch (displayStatus) {
    case 'queued':
      return {
        ...common,
        labelId: ETranslations.export_history_queued__title,
        statusIndicatorColor: '$textSubdued',
        statusTextColor: '$textSubdued',
        descriptionColor: '$textSubdued',
      };
    case 'processing':
      return {
        ...common,
        labelId: ETranslations.global_preparing,
        statusIndicatorColor: '$textSubdued',
        statusTextColor: '$textSubdued',
        descriptionColor: '$textSubdued',
      };
    case 'ready':
      return {
        ...common,
        labelId: ETranslations.export_history_ready__title,
        statusIndicatorColor: '$textSuccess',
        statusTextColor: '$textSubdued',
        descriptionColor: '$textSubdued',
      };
    case 'partial':
      return {
        ...common,
        labelId: ETranslations.export_history_partial__title,
        statusIndicatorColor: '$textCaution',
        statusTextColor: '$textCaution',
        descriptionId: ETranslations.export_history_limit_reached__desc,
        descriptionColor: '$textCaution',
      };
    case 'failed':
      return {
        ...common,
        labelId: ETranslations.global_failed,
        statusIndicatorColor: '$textCritical',
        statusTextColor: '$textCritical',
        descriptionId: ETranslations.export_history_failed__desc,
        descriptionColor: '$textCritical',
      };
    case 'expired':
      return {
        ...common,
        labelId: ETranslations.export_history_expired__title,
        statusIndicatorColor: '$textSubdued',
        statusTextColor: '$textSubdued',
        descriptionId: ETranslations.export_history_expired__desc,
        descriptionColor: '$textSubdued',
      };
    default:
      return {
        ...common,
        labelId: ETranslations.global_failed,
        statusIndicatorColor: '$textCritical',
        statusTextColor: '$textCritical',
        descriptionId: ETranslations.export_history_failed__desc,
        descriptionColor: '$textCritical',
      };
  }
}

export function getExportHistoryTaskNetworkIds(
  task: Pick<IExportTransactionHistoryTask, 'query'>,
) {
  return Object.keys(task.query.networkIdToAddressArray ?? {});
}

function getCalendarDateInTimeZone(timestampMs: number, timeZone?: string) {
  const date = new Date(timestampMs);
  if (!timeZone) {
    return date;
  }

  const offsetMatch = timeZone.match(/^(?:UTC)?([+-])(\d{2}):(\d{2})$/);
  if (offsetMatch) {
    const [, sign, hoursText, minutesText] = offsetMatch;
    const hours = Number(hoursText);
    const minutes = Number(minutesText);
    if (minutes < 60) {
      const offsetMinutes = (hours * 60 + minutes) * (sign === '+' ? 1 : -1);
      const shiftedDate = new Date(timestampMs + offsetMinutes * 60 * 1000);
      return new Date(
        shiftedDate.getUTCFullYear(),
        shiftedDate.getUTCMonth(),
        shiftedDate.getUTCDate(),
      );
    }
  }

  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, Number(part.value)]),
    );
    if (values.year && values.month && values.day) {
      return new Date(values.year, values.month - 1, values.day);
    }
  } catch {
    // Fall back to the device time zone for missing or invalid legacy values.
  }

  return date;
}

export function formatExportHistoryTaskDateRange(
  task: Pick<IExportTransactionHistoryTask, 'query'>,
) {
  const formatDay = (timestampMs: number) =>
    formatDate(getCalendarDateInTimeZone(timestampMs, task.query.timeZone), {
      hideTimeForever: true,
    });
  return `${formatDay(task.query.minTimestampMs)}–${formatDay(
    task.query.maxTimestampMs,
  )}`;
}

export function formatExportHistoryTaskFilenameDay(
  timestampMs: number,
  timeZone?: string,
) {
  return formatDate(getCalendarDateInTimeZone(timestampMs, timeZone), {
    formatTemplate: 'ddMMyy',
  });
}

export function formatExportHistoryTaskTime(timestampMs: number) {
  return formatDate(new Date(timestampMs), { hideSeconds: true });
}

export function formatExportHistoryTaskTimeZone(timeZone?: string) {
  if (!timeZone) {
    return undefined;
  }
  return timeZone.startsWith('+') || timeZone.startsWith('-')
    ? `UTC${timeZone}`
    : timeZone;
}
