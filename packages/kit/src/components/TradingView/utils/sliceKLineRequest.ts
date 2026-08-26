import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const DEFAULT_MAX_DATA_LENGTH = 2000;
const NATIVE_TOKEN_MAX_DATA_LENGTH = 200;
const MAX_TIME_SPAN_SECONDS = 5 * 365 * 24 * 60 * 60;

export interface ITimeSlice {
  from: number;
  to: number;
  interval: string;
}

export interface ISliceRequestOptions {
  isNativeToken?: boolean;
  minTimeSpanSeconds?: number;
}

function getIntervalInSeconds(interval: string): number {
  const match = interval.match(/^(\d+)([mHDWMy])$/);
  if (!match) {
    throw new OneKeyLocalError(`Invalid interval format: ${interval}`);
  }

  const [, value, unit] = match;
  const count = parseInt(value, 10);

  switch (unit) {
    case 'm':
      return count * 60;
    case 'H':
      return count * 60 * 60;
    case 'D':
      return count * 24 * 60 * 60;
    case 'W':
      return count * 7 * 24 * 60 * 60;
    case 'M':
      return count * 30 * 24 * 60 * 60;
    case 'y':
      return count * 365 * 24 * 60 * 60;
    default:
      throw new OneKeyLocalError(`Unsupported time unit: ${unit}`);
  }
}

export function sliceKLineRequest(
  interval: string,
  timeFrom: number,
  timeTo: number,
  options?: ISliceRequestOptions,
): ITimeSlice[] {
  const intervalSeconds = getIntervalInSeconds(interval);
  const minTimeSpanSeconds = options?.minTimeSpanSeconds ?? 0;
  const expandedTimeFrom =
    minTimeSpanSeconds > 0
      ? Math.min(timeFrom, timeTo - minTimeSpanSeconds)
      : timeFrom;
  const adjustedTimeFrom =
    timeTo - expandedTimeFrom > MAX_TIME_SPAN_SECONDS
      ? timeTo - MAX_TIME_SPAN_SECONDS
      : expandedTimeFrom;
  const maxDataLength = options?.isNativeToken
    ? NATIVE_TOKEN_MAX_DATA_LENGTH
    : DEFAULT_MAX_DATA_LENGTH;
  const totalDataPoints = Math.ceil(
    (timeTo - adjustedTimeFrom) / intervalSeconds,
  );

  if (totalDataPoints <= maxDataLength) {
    return [{ from: adjustedTimeFrom, to: timeTo, interval }];
  }

  const sliceCount = Math.ceil(totalDataPoints / maxDataLength);
  const timePerSlice = Math.floor((timeTo - adjustedTimeFrom) / sliceCount);

  return Array.from({ length: sliceCount }, (_, index) => ({
    from: adjustedTimeFrom + index * timePerSlice,
    to:
      index === sliceCount - 1
        ? timeTo
        : adjustedTimeFrom + (index + 1) * timePerSlice,
    interval,
  }));
}
