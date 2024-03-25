import { InteractionManager } from 'react-native';
import { logger as RNLogger, consoleTransport } from 'react-native-logs';

// import { stringifyFunc } from './stringifyFunc';
import { consoleFunc } from './utils';

import type { ILogLevel } from './types';

const dangerLogger = RNLogger.createLogger<ILogLevel>({
  async: true,
  // eslint-disable-next-line @typescript-eslint/unbound-method
  asyncFunc: InteractionManager.runAfterInteractions,
  dateFormat: 'iso',
  // stringifyFunc,
  transport: [consoleTransport],
  transportOptions: {
    consoleFunc,
  },
});

const loggerExtensions: Record<
  string,
  ReturnType<typeof dangerLogger.extend>
> = {};

export function getLoggerExtension(name: string) {
  if (!loggerExtensions[name]) {
    loggerExtensions[name] = dangerLogger.extend(name);
  }
  return loggerExtensions[name];
}
