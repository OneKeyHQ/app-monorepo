import logger from 'electron-log/renderer';

import platformEnv from '../../platformEnv';

import type { IUtilsType } from './types';

const consoleFunc = (msg: string) => {
  if (platformEnv.isDev) {
    // eslint-disable-next-line no-console
    console.log(msg);
  }
  logger.info(msg);
};

const getLogFilePath = () => Promise.resolve('');

const getDeviceInfo = () =>
  [
    `System: ${window.desktopApi.platform} ${window.desktopApi.systemVersion}`,
    `appPlatform: ${platformEnv.appPlatform ?? ''}`,
    `appChannel: ${platformEnv.appChannel ?? ''}`,
    `buildNumber: ${platformEnv.buildNumber ?? ''}`,
    `Version Hash: ${platformEnv.githubSHA ?? ''}`,
    `version: ${platformEnv.version ?? ''}`,
  ].join(',');

const utils: IUtilsType = { getDeviceInfo, getLogFilePath, consoleFunc };
export default utils;
