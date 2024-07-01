import { InteractionManager } from 'react-native';
import { logger as RNLogger, consoleTransport } from 'react-native-logs';

// import { stringifyFunc } from './stringifyFunc';
import utils from './utils';

import type { ILogLevel } from './types';

const dangerLogger = RNLogger.createLogger<ILogLevel>({
  async: true,
  // eslint-disable-next-line @typescript-eslint/unbound-method
  asyncFunc: InteractionManager.runAfterInteractions,
  dateFormat: 'time', // time, local, utc, iso
  // stringifyFunc,
  transport: [consoleTransport],
  transportOptions: {
    consoleFunc: utils.consoleFunc,
  },
  // format logger msg here
  // 06:37:59 | app | INFO :  log message
});

const loggerExtensions: Record<
  string,
  ReturnType<typeof dangerLogger.extend>
> = {};

export function getLoggerExtension(name: string) {
  // eslint-disable-next-line no-param-reassign
  // name += '@*!&&';
  if (!loggerExtensions[name]) {
    loggerExtensions[name] = dangerLogger.extend(name);
  }
  return loggerExtensions[name];
}
