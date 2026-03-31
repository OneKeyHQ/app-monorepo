import { logger as RNLogger, consoleTransport } from 'react-native-logs';

import timerUtils from '../utils/timerUtils';

import utils from './utils';

import type { ILogger, ILoggerMethods } from './types';

const createLogger = RNLogger.createLogger as unknown as (
  opts: Record<string, unknown>,
) => ILogger;

const dangerLogger = createLogger({
  async: true,
  asyncFunc: (...args: Parameters<typeof timerUtils.setTimeoutPromised>) =>
    timerUtils.setTimeoutPromised(...args),
  dateFormat: 'time', // time, local, utc, iso
  transport: [consoleTransport],
  transportOptions: {
    consoleFunc: utils.consoleFunc,
  },
  // format logger msg here
  // 06:37:59 | app | INFO :  log message
});

const loggerExtensions: Record<string, ILoggerMethods> = {};

export function getLoggerExtension(name: string): ILoggerMethods {
  if (!name) {
    return dangerLogger;
  }
  // name += '@*!&&';
  if (!loggerExtensions[name]) {
    loggerExtensions[name] = dangerLogger.extend(name);
  }
  return loggerExtensions[name];
}
