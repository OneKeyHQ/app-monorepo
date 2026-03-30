import appGlobals from '../../appGlobals';
import platformEnv from '../../platformEnv';
import { getLoggerExtension } from '../extensions';
import { loggerConfig } from '../loggerConfig';
import { stringifyFunc } from '../stringifyFunc';

import type { IMethodDecoratorMetadata } from '../types';

export type ILogEntry = {
  scopeName: string;
  sceneName: string;
  methodName: string;
  args: unknown[];
  metadata: IMethodDecoratorMetadata;
  durationInfo: {
    duration: string;
    totalDuration: number;
    lastDuration: number;
  };
  timestamp: () => string;
  rawArgs: unknown[];
};

// ---------------------------------------------------------------------------
// Log handlers — one per log target type
// ---------------------------------------------------------------------------

function logColorful(entry: ILogEntry, prefix: string) {
  if (
    platformEnv.isDev &&
    loggerConfig.colorfulLog &&
    loggerConfig.shouldLog(entry.scopeName, entry.sceneName)
  ) {
    const shouldHighlight =
      entry.durationInfo.lastDuration >=
      parseInt(loggerConfig.highlightDurationGt, 10) / 1000;
    console.log(
      `%c${entry.timestamp()} ###${prefix}`,
      shouldHighlight ? 'color: red; font-weight: bold;' : '',
      ...entry.rawArgs,
    );
  }
}

function handleLocalLog(entry: ILogEntry) {
  if (platformEnv.isWebEmbed) return;
  if (!loggerConfig.shouldLog(entry.scopeName, entry.sceneName)) return;

  const prefix = `${entry.scopeName} => ${entry.sceneName} => ${entry.methodName} : `;
  const rawMsg = stringifyFunc(...entry.args);
  let msg = `${prefix} ${rawMsg}`;

  if (process.env.NODE_ENV !== 'production' && platformEnv.isNative) {
    msg = msg.replace(/"/g, "'");
  }

  // Dedup is handled per-platform in the transport layer:
  //   web/ext: consoleFunc in utils/index.ts
  //   desktop: file.format hook in apps/desktop/app/logger.ts
  //   native:  OneKeyLog.swift / OneKeyLog.kt
  const logger = getLoggerExtension('');
  logger[entry.metadata.level || 'info'](msg);
  if (entry.metadata.level === 'error') {
    console.error(entry.timestamp(), msg);
  }
  logColorful(entry, prefix);
}

function handleServerLog(entry: ILogEntry) {
  appGlobals?.$analytics?.trackEvent(
    entry.methodName,
    (entry.args as Record<string, string>[]).reduce(
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
      {} as Record<string, string>,
    ),
  );
}

function handleConsoleLog(entry: ILogEntry) {
  const shouldLog = loggerConfig.shouldLog(entry.scopeName, entry.sceneName);
  if (!shouldLog) return;

  const prefix = `${entry.scopeName} => ${entry.sceneName} => ${entry.methodName} : `;
  const rawMsg = stringifyFunc(...entry.args);
  const msg = `${prefix} ${rawMsg}`;

  if (platformEnv.isNative) {
    console[entry.metadata.level || 'info'](`${entry.timestamp()} ${msg}`);
  }
  logColorful(entry, prefix);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function processEntry(entry: ILogEntry) {
  switch (entry.metadata.type) {
    case 'local':
      handleLocalLog(entry);
      break;
    case 'server':
      handleServerLog(entry);
      break;
    case 'console':
    default:
      handleConsoleLog(entry);
      break;
  }
}

export const logFn = (entry: ILogEntry) => {
  // Single async deferral with error boundary.
  // If config is not ready yet, loggerConfig queues and drains on init.
  setTimeout(() => {
    try {
      loggerConfig.enqueueOrProcess(entry, processEntry);
    } catch (error) {
      console.error('Logger error:', error);
    }
  });
};
