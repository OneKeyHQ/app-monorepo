import type { ISettingsDevModeInfo } from '@onekeyhq/kit/src/store/reducers/settings';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

import { waitForDataLoaded } from './promiseUtils';

let devModeInfo: ISettingsDevModeInfo | undefined;

async function getDevModeInfo() {
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

export default {
  getDevModeInfo,
  updateDevModeInfo,
};
