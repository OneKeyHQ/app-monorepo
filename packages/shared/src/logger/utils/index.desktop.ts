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
  // No JS-side dedup/truncation here — handled natively in electron main process
  // (apps/desktop/app/logger.ts: file.format hook with dedup + sanitizeAndTruncateData)
  appLogger.info(msg);
};

const getLogFilePath = () => Promise.resolve('');

const flushPendingRepeat = () => {};

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

const utils: IUtilsType = {
  getDeviceInfo,
  getLogFilePath,
  consoleFunc,
  flushPendingRepeat,
};
export default utils;
