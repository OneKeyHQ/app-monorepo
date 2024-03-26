import platformEnv from '../../platformEnv';

import type { IUtilsType } from './types';

const consoleFunc = (msg: string) => {
  console.log(msg);
  // eslint-disable-next-line
  global.$backgroundApiProxy.serviceLogger.addMsg(`${msg}\r\n`);
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getLogFilePath = async (filename: string) => {
  throw new Error('Not implemented');
};

const getDeviceInfo = () =>
  [
    `appPlatform: ${platformEnv.appPlatform ?? ''}`,
    `appChannel: ${platformEnv.appChannel ?? ''}`,
    `buildNumber: ${platformEnv.buildNumber ?? ''}`,
    `version: ${platformEnv.version ?? ''}`,
  ].join(',');

const utils: IUtilsType = { getDeviceInfo, getLogFilePath, consoleFunc };

export default utils;
