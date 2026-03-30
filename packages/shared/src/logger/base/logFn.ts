import appGlobals from '../../appGlobals';
import platformEnv from '../../platformEnv';
import { getLoggerExtension } from '../extensions';
import { defaultLoggerConfig } from '../loggerConfig';
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

// Per-scope dedup state instead of global single-slot
const dedupState = new Map<string, { prevMsg: string; count: number }>();

// Cached config — resolved once, no per-call await
let cachedConfig:
  | Awaited<typeof defaultLoggerConfig.savedLoggerConfigAsync>
  | undefined;

void defaultLoggerConfig.savedLoggerConfigAsync.then((config) => {
  cachedConfig = config;
});

function shouldLogToConsole(
  config: NonNullable<typeof cachedConfig>,
  scopeName: string,
  sceneName: string,
): boolean {
  return !platformEnv.isDev || !!config?.enabled?.[scopeName]?.[sceneName];
}

function logColorful(
  entry: ILogEntry,
  config: NonNullable<typeof cachedConfig>,
  prefix: string,
) {
  if (
    platformEnv.isDev &&
    config.colorfulLog &&
    shouldLogToConsole(config, entry.scopeName, entry.sceneName)
  ) {
    const shouldHighlight =
      entry.durationInfo.lastDuration >=
      parseInt(config.highlightDurationGt || '100', 10) / 1000;
    console.log(
      `%c${entry.timestamp()} ###${prefix}`,
      shouldHighlight ? 'color: red; font-weight: bold;' : '',
      ...entry.rawArgs,
    );
  }
}

function handleLocalLog(
  entry: ILogEntry,
  config: NonNullable<typeof cachedConfig>,
) {
  if (platformEnv.isWebEmbed) return;

  const shouldLog = shouldLogToConsole(
    config,
    entry.scopeName,
    entry.sceneName,
  );
  const prefix = `${entry.scopeName} => ${entry.sceneName} => ${entry.methodName} : `;
  const rawMsg = stringifyFunc(...entry.args);
  let msg = `${prefix} ${rawMsg}`;

  // Per-scope dedup
  const dedupKey = `${entry.scopeName}:${entry.sceneName}`;
  let state = dedupState.get(dedupKey);
  if (!state) {
    state = { prevMsg: '', count: 0 };
    dedupState.set(dedupKey, state);
  }

  if (state.prevMsg === msg) {
    state.count += 1;
    return;
  }

  if (process.env.NODE_ENV !== 'production' && platformEnv.isNative) {
    msg = msg.replace(/"/g, "'");
  }

  const logger = getLoggerExtension('');

  if (shouldLog) {
    if (state.count > 0) {
      logger.info(`└───[${state.count} repeat]`);
    }
    logger[entry.metadata.level || 'info'](msg);
    if (entry.metadata.level === 'error') {
      console.error(entry.timestamp(), msg);
    }
    logColorful(entry, config, prefix);
  }

  state.prevMsg = msg;
  state.count = 0;
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

function handleConsoleLog(
  entry: ILogEntry,
  config: NonNullable<typeof cachedConfig>,
) {
  const shouldLog = shouldLogToConsole(
    config,
    entry.scopeName,
    entry.sceneName,
  );
  if (!shouldLog) return;

  const prefix = `${entry.scopeName} => ${entry.sceneName} => ${entry.methodName} : `;
  const rawMsg = stringifyFunc(...entry.args);
  const msg = `${prefix} ${rawMsg}`;

  if (platformEnv.isNative) {
    console[entry.metadata.level || 'info'](`${entry.timestamp()} ${msg}`);
  }
  logColorful(entry, config, prefix);
}

export const logFn = (entry: ILogEntry) => {
  // Single async deferral with error boundary
  setTimeout(() => {
    try {
      const config = cachedConfig;
      if (!config) return;

      switch (entry.metadata.type) {
        case 'local':
          handleLocalLog(entry, config);
          break;
        case 'server':
          handleServerLog(entry);
          break;
        case 'console':
        default:
          handleConsoleLog(entry, config);
          break;
      }
    } catch (error) {
      console.error('Logger error:', error);
    }
  });
};
