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
  maxDataLength?: number;
  maxSliceCount?: number;
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
  const maxDataLength =
    options?.maxDataLength ??
    (options?.isNativeToken
      ? NATIVE_TOKEN_MAX_DATA_LENGTH
      : DEFAULT_MAX_DATA_LENGTH);
  if (!Number.isSafeInteger(maxDataLength) || maxDataLength < 2) {
    throw new OneKeyLocalError(
      `maxDataLength must be a safe integer greater than 1: ${maxDataLength}`,
    );
  }

  const maxSliceCount = options?.maxSliceCount;
  if (
    maxSliceCount !== undefined &&
    (!Number.isSafeInteger(maxSliceCount) || maxSliceCount < 1)
  ) {
    throw new OneKeyLocalError(
      `maxSliceCount must be a positive safe integer: ${maxSliceCount}`,
    );
  }

  const totalDataPoints = Math.ceil(
    (timeTo - adjustedTimeFrom) / intervalSeconds,
  );

  if (totalDataPoints <= maxDataLength) {
    return [{ from: adjustedTimeFrom, to: timeTo, interval }];
  }

  const maxSliceTimeSpan = maxDataLength * intervalSeconds;
  const sliceStep = maxSliceTimeSpan - intervalSeconds;
  const totalTimeSpan = timeTo - adjustedTimeFrom;
  const sliceCount =
    1 + Math.ceil((totalTimeSpan - maxSliceTimeSpan) / sliceStep);

  if (maxSliceCount !== undefined && sliceCount > maxSliceCount) {
    throw new OneKeyLocalError(
      `K-line request requires ${sliceCount} slices, exceeding the limit of ${maxSliceCount}`,
    );
  }

  return Array.from({ length: sliceCount }, (_, index) => {
    const from = adjustedTimeFrom + index * sliceStep;
    return {
      // Adjacent slices overlap by one interval because the endpoint excludes boundaries.
      from,
      to: Math.min(from + maxSliceTimeSpan, timeTo),
      interval,
    };
  });
}
