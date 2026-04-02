import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import appGlobals from '../../appGlobals';
import platformEnv from '../../platformEnv';

import type { IUtilsType } from './types';

// Web/ext only: JS-side dedup + truncation before IPC to ServiceLogger.
// Desktop and native handle dedup natively (OneKeyLog.swift / OneKeyLog.kt / logger.ts).
const MSG_LIMIT = 2000;
let prevMsg: string | undefined;
let repeatCount = 0;

const consoleFunc = (msg: string) => {
  const dedupKey = msg.includes(' : ')
    ? msg.slice(msg.indexOf(' : ') + 3)
    : msg;

  if (platformEnv.isDev) {
    // eslint-disable-next-line no-console
    console.log(msg);
  }

  // Collapse identical consecutive messages to avoid IPC overhead
  if (dedupKey === prevMsg) {
    repeatCount += 1;
    return;
  }
  if (repeatCount > 0) {
    // eslint-disable-next-line
    appGlobals?.$backgroundApiProxy?.serviceLogger.addMsg(
      `[${repeatCount} repeat]\r\n`,
    );
  }
  prevMsg = dedupKey;
  repeatCount = 0;

  // Truncate before IPC serialization to limit bridge payload size
  const truncated =
    msg.length > MSG_LIMIT ? `${msg.slice(0, MSG_LIMIT)}...(truncated)` : msg;
  // eslint-disable-next-line
  appGlobals?.$backgroundApiProxy?.serviceLogger.addMsg(`${truncated}\r\n`);
};

/** Flush any pending repeat summary to ServiceLogger before log export. */
const flushPendingRepeat = async () => {
  if (repeatCount > 0) {
    await appGlobals?.$backgroundApiProxy?.serviceLogger.addMsg(
      `[${repeatCount} repeat]\r\n`,
    );
    repeatCount = 0;
  }
  prevMsg = undefined;
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
    `bundleVersion: ${platformEnv.bundleVersion ?? ''}`,
    `browserInfo: ${platformEnv.browserInfo ?? ''}`,
  ].join(',');

const utils: IUtilsType = {
  getDeviceInfo,
  getLogFilePath,
  consoleFunc,
  flushPendingRepeat,
};

export default utils;
