import appGlobals from '../../appGlobals';
import platformEnv from '../../platformEnv';
import { getLoggerExtension } from '../extensions';
import { loggerConfig } from '../loggerConfig';
import { loggerRuntime } from '../runtime/loggerRuntime';
import { stringifyFunc } from '../stringifyFunc';

import type { IMethodDecoratorMetadata } from '../types';

export type ILogEntry = {
  scopeName: string;
  sceneName: string;
  methodName: string;
  args: unknown[];
  metadataList: IMethodDecoratorMetadata[];
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

// ---------------------------------------------------------------------------
// Entry point — computes shared values once, dispatches per metadata
// ---------------------------------------------------------------------------

function processEntry(entry: ILogEntry) {
  const shouldLog = loggerConfig.shouldLog(entry.scopeName, entry.sceneName);

  // Lazy message: only computed when a local/console handler needs it.
  // stringifyFunc is expensive (stableStringify + depth check + error conversion).
  let _msg: string | undefined;
  const getMsg = () => {
    if (_msg !== undefined) return _msg;
    const prefix = `${entry.scopeName} => ${entry.sceneName} => ${entry.methodName} : `;
    const rawMsg = stringifyFunc(...entry.args);
    _msg = `${prefix} ${rawMsg}`;
    if (process.env.NODE_ENV !== 'production' && platformEnv.isNative) {
      _msg = _msg.replace(/"/g, "'");
    }
    return _msg;
  };

  // Track whether any local/console handler ran, for a single colorful output
  let needsColorful = false;

  for (const metadata of entry.metadataList) {
    switch (metadata.type) {
      case 'local':
        // Dedup is handled per-platform in the transport layer:
        //   web/ext: consoleFunc in utils/index.ts
        //   desktop: file.format hook in apps/desktop/app/logger.ts
        //   native:  OneKeyLog.swift / OneKeyLog.kt
        if (!platformEnv.isWebEmbed && shouldLog) {
          const logger = getLoggerExtension('');
          logger[metadata.level || 'info'](getMsg());
          if (metadata.level === 'error' && platformEnv.isDev) {
            console.error(entry.timestamp(), getMsg());
          }
          needsColorful = true;
        }
        break;
      case 'server':
        handleServerLog(entry);
        break;
      case 'console':
      default:
        if (shouldLog) {
          if (platformEnv.isNative) {
            console[metadata.level || 'info'](
              `${entry.timestamp()} ${getMsg()}`,
            );
          }
          needsColorful = true;
        }
        break;
    }
  }

  // Colorful log fires at most once per entry, not per metadata
  if (needsColorful && platformEnv.isDev && loggerConfig.colorfulLog) {
    const prefix = `${entry.scopeName} => ${entry.sceneName} => ${entry.methodName} : `;
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

export const logFn = (entry: ILogEntry) => {
  // Single async deferral with error boundary.
  // If config is not ready yet, loggerRuntime queues until init drains it.
  setTimeout(() => {
    try {
      loggerRuntime.enqueueOrProcess(loggerConfig.isReady, entry, processEntry);
    } catch (error) {
      console.error('Logger error:', error);
    }
  });
};
