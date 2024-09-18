import platformEnv from '../../platformEnv';
import { getLoggerExtension } from '../extensions';
import { defaultLoggerConfig } from '../loggerConfig';

import type { IMethodDecoratorMetadata, Metadata } from '../types';

export const logFn = ({
  scopeName,
  sceneName,
  durationInfo,
  timestamp,
  metadata,
  methodName,
  rawMsg,
  obj,
}: {
  scopeName: string;
  sceneName: string;
  durationInfo: {
    duration: string;
    totalDuration: number;
    lastDuration: number;
  };
  timestamp: () => string;
  methodName: string;
  rawMsg: string; // serialized string of obj.args
  metadata: IMethodDecoratorMetadata;
  obj: Metadata;
}) => {
  setTimeout(async () => {
    const config = await defaultLoggerConfig.savedLoggerConfigAsync;
    const shouldLogToConsole =
      !platformEnv.isDev || !!config?.enabled?.[scopeName]?.[sceneName];
    const prefix = `***log*** ${scopeName} => ${sceneName} => ${methodName} : `;
    let msg = `${prefix} ${rawMsg}`;

    if (process.env.NODE_ENV !== 'production' && platformEnv.isNative) {
      // RN chrome remote console cannot display correct JSON stringify strings, so change to single quotes
      msg = msg.replace(/"/g, "'");
    }

    const logColorfulOriginalObj = () => {
      if (shouldLogToConsole && platformEnv.isDev && config.colorfulLog) {
        const shouldHighlight =
          durationInfo.lastDuration >=
          parseInt(config.highlightDurationGt || '100', 10) / 1000;
        console.log(
          `%c${timestamp()} ###${prefix}`,
          shouldHighlight ? 'color: red; font-weight: bold;' : '',
          ...obj.args,
        );
      }
    };

    switch (metadata.type) {
      case 'local':
        {
          // const extensionName = `${scopeName} -> ${sceneName}`;
          // const logger = getLoggerExtension(extensionName);
          // msg including extensionName, don't need to create a new logger extension

          const logger = getLoggerExtension(''); // use root logger instance
          if (shouldLogToConsole) {
            logger[metadata.level](msg);
            if (metadata.level === 'error') {
              console.error(timestamp(), msg);
            }
            logColorfulOriginalObj();
          }
        }
        break;
      case 'server':
        global?.$analytics?.trackEvent(
          methodName,
          (obj.args as Record<string, string>[]).reduce(
            (prev, current, index) => {
              if (!current) {
                return prev;
              }
              const value =
                typeof current === 'object' && !Array.isArray(current)
                  ? current
                  : { [index]: current };
              return { ...prev, ...value };
            },
            {},
          ),
        );
        break;
      case 'console':
      default: {
        if (shouldLogToConsole) {
          if (platformEnv.isNative) {
            console[metadata.level](`${timestamp()} ${msg}`);
          }
          logColorfulOriginalObj();
        }
      }
    }
  });
};
