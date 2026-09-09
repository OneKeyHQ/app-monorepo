function getTimezoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US-u-hc-h23', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const dateParts = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return (
    Date.UTC(
      dateParts.year,
      dateParts.month - 1,
      dateParts.day,
      dateParts.hour,
      dateParts.minute,
      dateParts.second,
    ) - date.getTime()
  );
}

function getStartOfDayTimestamp(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

const CALENDAR_FUTURE_OFFSET_SECONDS = 24 * 60 * 60;

export function getCalendarMaximumTimestamp({
  nowTimestamp,
  rangeMaximumTimestamp,
}: {
  nowTimestamp: number;
  rangeMaximumTimestamp?: number;
}) {
  const currentMaximumTimestamp = nowTimestamp + CALENDAR_FUTURE_OFFSET_SECONDS;
  return rangeMaximumTimestamp === undefined
    ? currentMaximumTimestamp
    : Math.min(rangeMaximumTimestamp, currentMaximumTimestamp);
}

export function getChartDateFromTimestamp({
  timeZone,
  timestamp,
}: {
  timeZone: string;
  timestamp: number;
}) {
  if (!Number.isFinite(timestamp)) {
    return undefined;
  }
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp * 1000));
  const dateParts = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  if (
    !Number.isFinite(dateParts.year) ||
    !Number.isFinite(dateParts.month) ||
    !Number.isFinite(dateParts.day)
  ) {
    return undefined;
  }
  return new Date(dateParts.year, dateParts.month - 1, dateParts.day);
}

export function isCalendarDateInRange({
  date,
  maximumDate,
  minimumDate,
}: {
  date: Date;
  maximumDate?: Date;
  minimumDate?: Date;
}) {
  const timestamp = getStartOfDayTimestamp(date);
  return (
    (minimumDate === undefined ||
      timestamp >= getStartOfDayTimestamp(minimumDate)) &&
    (maximumDate === undefined ||
      timestamp <= getStartOfDayTimestamp(maximumDate))
  );
}

export function clampCalendarDateToRange({
  date,
  maximumDate,
  minimumDate,
}: {
  date: Date;
  maximumDate?: Date;
  minimumDate?: Date;
}) {
  if (
    minimumDate &&
    getStartOfDayTimestamp(date) < getStartOfDayTimestamp(minimumDate)
  ) {
    return new Date(minimumDate);
  }
  if (
    maximumDate &&
    getStartOfDayTimestamp(date) > getStartOfDayTimestamp(maximumDate)
  ) {
    return new Date(maximumDate);
  }
  return date;
}

export function isCalendarMonthInRange({
  maximumDate,
  minimumDate,
  monthDate,
}: {
  maximumDate?: Date;
  minimumDate?: Date;
  monthDate: Date;
}) {
  const firstDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const lastDate = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  );
  return (
    (minimumDate === undefined ||
      getStartOfDayTimestamp(lastDate) >=
        getStartOfDayTimestamp(minimumDate)) &&
    (maximumDate === undefined ||
      getStartOfDayTimestamp(firstDate) <= getStartOfDayTimestamp(maximumDate))
  );
}

export function buildChartTimestamp({
  date,
  totalMinutes,
  timeZone,
}: {
  date: Date;
  totalMinutes: number;
  timeZone: string;
}) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const utcTime = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
  );
  const offset = getTimezoneOffsetMs(new Date(utcTime), timeZone);
  const adjustedOffset = getTimezoneOffsetMs(
    new Date(utcTime - offset),
    timeZone,
  );

  return Math.floor((utcTime - adjustedOffset) / 1000);
}

export function normalizeRangeEndSelection({
  rangeStartDate,
  nextDate,
}: {
  rangeStartDate: Date;
  nextDate: Date;
}) {
  if (nextDate.getTime() < rangeStartDate.getTime()) {
    return {
      rangeStartDate: nextDate,
      rangeEndDate: rangeStartDate,
    };
  }

  return {
    rangeStartDate,
    rangeEndDate: nextDate,
  };
}
