import logger from 'electron-log/renderer';

import platformEnv from '../../platformEnv';

import type { IUtilsType } from './types';

logger.transports.console.level = false;

// Use 'app' scope so the main process format function can identify
// renderer-originated messages and apply filtering there.
const appLogger = logger.scope('app');

const consoleFunc = (msg: string) => {
  if (platformEnv.isDev) {
    // eslint-disable-next-line no-console
    console.log(msg);
  }
  // Send raw message to main process; sanitization, truncation,
  // and rate limiting are handled in the main process format function
  // to avoid blocking the renderer JS thread.
  appLogger.info(msg);
};

const getLogFilePath = () => Promise.resolve('');

const desktopPlatform = globalThis.desktopApi.platform;
const desktopSystemVersion = globalThis.desktopApi.systemVersion;
const getDeviceInfo = () =>
  [
    `System: ${desktopPlatform} ${desktopSystemVersion}`,
    `appPlatform: ${platformEnv.appPlatform ?? ''}`,
    `appChannel: ${platformEnv.appChannel ?? ''}`,
    `buildNumber: ${platformEnv.buildNumber ?? ''}`,
    `bundleVersion: ${platformEnv.bundleVersion ?? ''}`,
    `Version Hash: ${platformEnv.githubSHA ?? ''}`,
    `version: ${platformEnv.version ?? ''}`,
  ].join(',');

const utils: IUtilsType = { getDeviceInfo, getLogFilePath, consoleFunc };
export default utils;
