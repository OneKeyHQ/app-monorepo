/**
 * The share price stops moving outside regular trading, so a closed or
 * overnight market shows when the quote feed last changed it. The label is the
 * viewer's local clock plus its UTC offset, because the reader's question is
 * "how stale is this number for me".
 */
function formatUtcOffsetLabel(date: Date): string {
  // `getTimezoneOffset` counts minutes behind UTC, so UTC+8 reports -480.
  const offsetMinutes = -date.getTimezoneOffset();
  if (offsetMinutes === 0) {
    return 'UTC';
  }
  const sign = offsetMinutes > 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  // Half-hour and 45-minute zones (India, Nepal) need the minutes spelled out.
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${`${minutes}`.padStart(2, '0')}`;
}

export function formatStockLastUpdateTime(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }
  const date = new Date(timestamp);
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes} ${formatUtcOffsetLabel(date)}`;
}
