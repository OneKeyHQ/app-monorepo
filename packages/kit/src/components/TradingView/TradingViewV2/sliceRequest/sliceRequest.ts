import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const maxDataLength = 100;

export interface ITimeSlice {
  from: number;
  to: number;
  interval: string;
}

export function sliceRequest(
  interval: string,
  timeFrom: number,
  timeTo: number,
): ITimeSlice[] {
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

  // Calculate total data points
  const totalDataPoints = Math.ceil((timeTo - timeFrom) / intervalSeconds);

  // If data points don't exceed the limit, return the original range directly
  if (totalDataPoints <= maxDataLength) {
    return [{ from: timeFrom, to: timeTo, interval }];
  }

  // Calculate how many slices are needed
  const sliceCount = Math.ceil(totalDataPoints / maxDataLength);

  // Calculate time length per slice
  const timePerSlice = Math.floor((timeTo - timeFrom) / sliceCount);

  const slices: ITimeSlice[] = [];

  for (let i = 0; i < sliceCount; i += 1) {
    const sliceFrom = timeFrom + i * timePerSlice;
    let sliceTo: number;

    if (i === sliceCount - 1) {
      // Last slice uses the original end time to ensure no data is missed
      sliceTo = timeTo;
    } else {
      sliceTo = timeFrom + (i + 1) * timePerSlice;
    }

    slices.push({
      from: sliceFrom,
      to: sliceTo,
      interval,
    });
  }

  return slices;
}
