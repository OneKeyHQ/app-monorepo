import type { ISettingsDevModeInfo } from '@onekeyhq/kit/src/store/reducers/settings';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

import { waitForDataLoaded } from './promiseUtils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const IS_DEV = process.env.NODE_ENV !== 'production';
let devModeInfo: ISettingsDevModeInfo | undefined;

function getDevModeInfo() {
  return devModeInfo;
}
async function getDevModeInfoAsync() {
  await waitForDataLoaded({
    data: () => devModeInfo,
    wait: 1000,
    logName: 'devModeUtils.getDevModeInfo',
    timeout: getTimeDurationMs({
      minute: 3,
    }),
  });
  return devModeInfo;
}

function updateDevModeInfo(info?: ISettingsDevModeInfo) {
  if (info) devModeInfo = info;
}

const devOnlyDataFallbackMessage = '❃❃❃❃';

export function devOnlyData<T>(
  data: T,
  fallback = devOnlyDataFallbackMessage,
): T | string {
  if (devModeInfo?.enable) {
    return data;
  }
  // if (IS_DEV) {
  //   return data as unknown;
  // }
  return fallback;
}

export async function devOnlyDataAsync<T>(
  data: T,
  fallback = devOnlyDataFallbackMessage,
): Promise<T | string> {
  await getDevModeInfoAsync();
  return devOnlyData(data, fallback);
}

export default {
  getDevModeInfo,
  getDevModeInfoAsync,
  updateDevModeInfo,
};
