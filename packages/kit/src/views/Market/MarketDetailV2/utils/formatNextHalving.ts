const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;
const SECONDS_PER_30_DAYS = 30 * SECONDS_PER_DAY;

const pluralise = (count: number, singular: string) =>
  `${count} ${count === 1 ? singular : `${singular}s`}`;

export function formatNextHalving(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '~Imminent';
  }

  const totalSeconds = Math.floor(seconds);

  if (totalSeconds >= SECONDS_PER_YEAR) {
    const years = Math.floor(totalSeconds / SECONDS_PER_YEAR);
    const remainingDays = Math.floor(
      (totalSeconds - years * SECONDS_PER_YEAR) / SECONDS_PER_DAY,
    );
    if (remainingDays === 0) {
      return `~${pluralise(years, 'year')}`;
    }
    return `~${pluralise(years, 'year')} ${pluralise(remainingDays, 'day')}`;
  }

  if (totalSeconds >= SECONDS_PER_30_DAYS) {
    const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
    return `~${pluralise(days, 'day')}`;
  }

  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const hours = Math.floor(
    (totalSeconds - days * SECONDS_PER_DAY) / SECONDS_PER_HOUR,
  );
  if (hours === 0 && days > 0) {
    return `~${pluralise(days, 'day')}`;
  }
  return `~${pluralise(days, 'day')} ${pluralise(hours, 'hour')}`;
}
