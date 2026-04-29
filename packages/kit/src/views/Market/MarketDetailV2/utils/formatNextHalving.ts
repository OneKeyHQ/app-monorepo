const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;
const SECONDS_PER_30_DAYS = 30 * SECONDS_PER_DAY;

export interface INextHalvingUnitFormatters {
  y: (amount: number) => string;
  d: (amount: number) => string;
  h: (amount: number) => string;
  imminent: () => string;
}

export function formatNextHalving(
  seconds: number,
  fmt: INextHalvingUnitFormatters,
): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return `~${fmt.imminent()}`;
  }

  const totalSeconds = Math.floor(seconds);

  if (totalSeconds >= SECONDS_PER_YEAR) {
    const years = Math.floor(totalSeconds / SECONDS_PER_YEAR);
    const remainingDays = Math.floor(
      (totalSeconds - years * SECONDS_PER_YEAR) / SECONDS_PER_DAY,
    );
    if (remainingDays === 0) {
      return `~${fmt.y(years)}`;
    }
    return `~${fmt.y(years)} ${fmt.d(remainingDays)}`;
  }

  if (totalSeconds >= SECONDS_PER_30_DAYS) {
    const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
    return `~${fmt.d(days)}`;
  }

  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const hours = Math.floor(
    (totalSeconds - days * SECONDS_PER_DAY) / SECONDS_PER_HOUR,
  );
  if (days === 0 && hours === 0) {
    return `~${fmt.imminent()}`;
  }
  if (days === 0) {
    return `~${fmt.h(hours)}`;
  }
  if (hours === 0 && days > 0) {
    return `~${fmt.d(days)}`;
  }
  return `~${fmt.d(days)} ${fmt.h(hours)}`;
}
