import { analytics } from '../../analytics';
import platformEnv from '../../platformEnv';
import { formatTime } from '../../utils/dateUtils';
import timerUtils from '../../utils/timerUtils';
import { getLoggerExtension } from '../extensions';
import { defaultLoggerConfig } from '../loggerConfig';

import type { IMethodDecoratorMetadata, Metadata } from '../types';

export const logFn = ({
  scopeName,
  sceneName,
  metadata,
  methodName,
  rawMsg,
  obj,
}: {
  scopeName: string;
  sceneName: string;
  methodName: string;
  rawMsg: string; // serialized string of obj.args
  metadata: IMethodDecoratorMetadata;
  obj: Metadata;
}) => {
  setTimeout(async () => {
    const config = await defaultLoggerConfig.savedLoggerConfigAsync;
    const shouldLogToConsole =
      !platformEnv.isDev || !!config?.[scopeName]?.[sceneName];
    const prefix = `***log*** ${scopeName} => ${sceneName} => ${methodName} : `;
    const msg = `${prefix} ${rawMsg}`;
    const timestamp = () =>
      formatTime(new Date(), {
        formatTemplate: 'HH:mm:ss.SSS',
      });
    switch (metadata.type) {
      case 'local':
        {
          // const extensionName = `${scopeName} -> ${sceneName}`;
          // const logger = getLoggerExtension(extensionName);

          // msg including extensionName, don't need to create a new logger extension
          const logger = getLoggerExtension('');
          if (shouldLogToConsole) {
            logger[metadata.level](msg);
          }
          if (metadata.level === 'error') {
            if (shouldLogToConsole) {
              console.error(timestamp(), msg);
            }
          }
        }
        break;
      case 'server':
        analytics.trackEvent(methodName, { msg });
        break;
      case 'console':
      default: {
        if (shouldLogToConsole) {
          if (platformEnv.isNative) {
            console[metadata.level](timestamp(), msg);
          } else {
            console[metadata.level](timestamp(), prefix, ...obj.args);
          }
        }
      }
    }
  });
};
