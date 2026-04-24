import { formatDistanceStrict } from '@onekeyhq/shared/src/utils/dateUtils';

function normalizeTimestamp(date: Date | number) {
  if (typeof date === 'number' && date.toString().length <= 10) {
    return date * 1000;
  }

  return date;
}

export function formatRelativeTimeAbbrAt(
  date: Date | number,
  baseDate: Date | number,
) {
  const distance = formatDistanceStrict(
    normalizeTimestamp(date),
    normalizeTimestamp(baseDate),
    false,
    'floor',
    'en-US',
  );

  return distance
    .replace(/\d+\s*seconds?/g, (match) => `${match.match(/\d+/)?.[0] || ''}s`)
    .replace(/\d+\s*minutes?/g, (match) => `${match.match(/\d+/)?.[0] || ''}m`)
    .replace(/\d+\s*hours?/g, (match) => `${match.match(/\d+/)?.[0] || ''}h`)
    .replace(/\d+\s*days?/g, (match) => `${match.match(/\d+/)?.[0] || ''}d`)
    .replace(/\d+\s*months?/g, (match) => `${match.match(/\d+/)?.[0] || ''}mo`)
    .replace(/\d+\s*years?/g, (match) => `${match.match(/\d+/)?.[0] || ''}y`);
}
