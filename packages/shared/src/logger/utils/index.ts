import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import appGlobals from '../../appGlobals';
import platformEnv from '../../platformEnv';

import type { IUtilsType } from './types';

const consoleFunc = (msg: string) => {
  if (platformEnv.isDev) {
    // eslint-disable-next-line no-console
    console.log(msg);
  }
  // eslint-disable-next-line
  appGlobals?.$backgroundApiProxy?.serviceLogger.addMsg(`${msg}\r\n`);
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getLogFilePath = async (filename: string) => {
  throw new OneKeyLocalError('Not implemented');
};

const getDeviceInfo = () =>
  [
    `appPlatform: ${platformEnv.appPlatform ?? ''}`,
    `appChannel: ${platformEnv.appChannel ?? ''}`,
    `buildNumber: ${platformEnv.buildNumber ?? ''}`,
    `version: ${platformEnv.version ?? ''}`,
    `browserInfo: ${platformEnv.browserInfo ?? ''}`,
  ].join(',');

const utils: IUtilsType = { getDeviceInfo, getLogFilePath, consoleFunc };

export default utils;
