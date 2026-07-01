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
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return (
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    ) - date.getTime()
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
