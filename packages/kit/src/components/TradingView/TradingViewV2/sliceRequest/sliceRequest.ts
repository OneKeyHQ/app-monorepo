import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const DEFAULT_MAX_DATA_LENGTH = 2000;
const NATIVE_TOKEN_MAX_DATA_LENGTH = 200;
const MAX_TIME_SPAN_YEARS = 5;
const MAX_TIME_SPAN_SECONDS = MAX_TIME_SPAN_YEARS * 365 * 24 * 60 * 60; // 5 years in seconds

export interface ITimeSlice {
  from: number;
  to: number;
  interval: string;
}

export interface ISliceRequestOptions {
  isNativeToken?: boolean;
}

export function sliceRequest(
  interval: string,
  timeFrom: number,
  timeTo: number,
  options?: ISliceRequestOptions,
): ITimeSlice[] {
  // Limit time span to maximum 5 years, adjust timeFrom if necessary
  const timeSpan = timeTo - timeFrom;
  const adjustedTimeFrom =
    timeSpan > MAX_TIME_SPAN_SECONDS
      ? timeTo - MAX_TIME_SPAN_SECONDS
      : timeFrom;
  const getIntervalInSeconds = (intervalStr: string): number => {
    const match = intervalStr.match(/^(\d+)([mHDWMy])$/);
    if (!match) {
      throw new OneKeyLocalError(`Invalid interval format: ${intervalStr}`);
    }

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 'm':
        return num * 60; // minutes
      case 'H':
        return num * 60 * 60; // hours
      case 'D':
        return num * 24 * 60 * 60; // days
      case 'W':
        return num * 7 * 24 * 60 * 60; // weeks
      case 'M':
        return num * 30 * 24 * 60 * 60; // months (calculated as 30 days)
      case 'y':
        return num * 365 * 24 * 60 * 60; // years (calculated as 365 days)
      default:
        throw new OneKeyLocalError(`Unsupported time unit: ${unit}`);
    }
  };

  const intervalSeconds = getIntervalInSeconds(interval);

  // Determine max data length based on token type
  const maxDataLength = options?.isNativeToken
    ? NATIVE_TOKEN_MAX_DATA_LENGTH
    : DEFAULT_MAX_DATA_LENGTH;

  // Calculate total data points with adjusted time range
  const totalDataPoints = Math.ceil(
    (timeTo - adjustedTimeFrom) / intervalSeconds,
  );

  // If data points don't exceed the limit, return the adjusted range directly
  if (totalDataPoints <= maxDataLength) {
    return [{ from: adjustedTimeFrom, to: timeTo, interval }];
  }

  // Calculate how many slices are needed
  const sliceCount = Math.ceil(totalDataPoints / maxDataLength);

  // Calculate time length per slice
  const timePerSlice = Math.floor((timeTo - adjustedTimeFrom) / sliceCount);

  const slices: ITimeSlice[] = [];

  for (let i = 0; i < sliceCount; i += 1) {
    const sliceFrom = adjustedTimeFrom + i * timePerSlice;
    let sliceTo: number;

    if (i === sliceCount - 1) {
      // Last slice uses the original end time to ensure no data is missed
      sliceTo = timeTo;
    } else {
      sliceTo = adjustedTimeFrom + (i + 1) * timePerSlice;
    }

    slices.push({
      from: sliceFrom,
      to: sliceTo,
      interval,
    });
  }

  return slices;
}
