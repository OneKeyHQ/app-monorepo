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
    const match = intervalStr.toLowerCase().match(/^(\d+)([mhdwMy])$/);
    if (!match) {
      throw new OneKeyLocalError(`Invalid interval format: ${intervalStr}`);
    }

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit.toLowerCase()) {
      case 'm':
        return num * 60; // 分钟
      case 'h':
        return num * 60 * 60; // 小时
      case 'd':
        return num * 24 * 60 * 60; // 天
      case 'w':
        return num * 7 * 24 * 60 * 60; // 周
      case 'M':
        return num * 30 * 24 * 60 * 60; // 月（按30天计算）
      case 'y':
        return num * 365 * 24 * 60 * 60; // 年（按365天计算）
      default:
        throw new OneKeyLocalError(`Unsupported time unit: ${unit}`);
    }
  };

  const intervalSeconds = getIntervalInSeconds(interval);

  // 计算总的数据点数量
  const totalDataPoints = Math.ceil((timeTo - timeFrom) / intervalSeconds);

  // 如果数据点数量不超过限制，直接返回原始范围
  if (totalDataPoints <= maxDataLength) {
    return [{ from: timeFrom, to: timeTo, interval }];
  }

  // 计算需要分成几片
  const sliceCount = Math.ceil(totalDataPoints / maxDataLength);

  // 计算每片的时间长度
  const timePerSlice = Math.floor((timeTo - timeFrom) / sliceCount);

  const slices: ITimeSlice[] = [];

  for (let i = 0; i < sliceCount; i += 1) {
    const sliceFrom = timeFrom + i * timePerSlice;
    let sliceTo: number;

    if (i === sliceCount - 1) {
      // 最后一片使用原始的结束时间，确保不遗漏数据
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
