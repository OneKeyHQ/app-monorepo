import { analytics } from '../../analytics';
import platformEnv from '../../platformEnv';
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
    const prefix = `${scopeName} -> ${sceneName} -> ${methodName} : `;
    const msg = `${prefix} ${rawMsg}`;
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
              console.error(msg);
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
            console[metadata.level](msg);
          } else {
            console[metadata.level](prefix, ...obj.args);
          }
        }
      }
    }
  });
};
