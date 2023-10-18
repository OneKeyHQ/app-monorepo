import { format as fnsFormat } from 'date-fns';
import safeStringify from 'json-stringify-safe';
import { isArray, isNil } from 'lodash';
import { InteractionManager } from 'react-native';
import {
  getBuildNumber,
  getDeviceId,
  getIncrementalSync,
  getModel,
  getSystemName,
  getSystemVersion,
  getTotalMemorySync,
  getUsedMemorySync,
} from 'react-native-device-info';
import { logger as RNLogger, consoleTransport } from 'react-native-logs';

import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  FileLogger,
  LogLevel,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import { zip } from '@onekeyhq/shared/src/modules3rdParty/react-native-zip-archive';

import { toPlainErrorObject } from '../errors/utils/errorUtils';
import platformEnv from '../platformEnv';
import appStorage from '../storage/appStorage';
import devModeUtils from '../utils/devModeUtils';
import { waitForDataLoaded } from '../utils/promiseUtils';

type IConsoleFuncProps = {
  msg: any;
  rawMsg: any;
  level: { severity: number; text: string };
  extension?: string | null;
  options?: any;
};

const LOG_STRING_LIMIT = 3000;

const IS_DEV = process.env.NODE_ENV !== 'production';
// const IS_DEV = false;
const IS_PRD = !IS_DEV;

let debugLoggerInitedDone = false;
const debugLoggerSettingsCache: {
  [name: string]: boolean;
} = {};

function isFlowLogger(name: string) {
  return name.startsWith('flow');
}

function countObjectDepth(source: unknown, maxDepth = 5, depth = 0): number {
  const currentDepth = depth + 1;
  if (currentDepth > maxDepth) {
    return currentDepth;
  }

  if (source == null) {
    return currentDepth;
  }

  if (typeof source !== 'object' || typeof source === 'function') {
    return currentDepth;
  }

  if (Array.isArray(source)) {
    return Math.max(
      ...source.map((item) => countObjectDepth(item, maxDepth, currentDepth)),
    );
  }

  const keys = Object.getOwnPropertyNames(source);
  return Math.max(
    ...keys.map((k) =>
      countObjectDepth(
        (source as { [k: string]: unknown })[k],
        maxDepth,
        currentDepth,
      ),
    ),
  );
}

function convertErrorObject(...args: any[]): any[] {
  return args.map((arg) => {
    if (arg instanceof Error) {
      const error = toPlainErrorObject(arg as any);
      if (IS_PRD) {
        if (error && error.stack) {
          delete error.stack;
        }
      }
      return error;
    }
    if (isArray(arg)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return convertErrorObject(...arg);
    }
    return arg as unknown;
  });
}

function stringifyLog(...args: any[]) {
  const argsNew = convertErrorObject(...args);
  if (IS_DEV) {
    const maxDepth = 6;
    try {
      argsNew.forEach((arg) => {
        if (countObjectDepth(arg, maxDepth) > maxDepth) {
          console.warn(
            `Arg nesting too deep. This will affect the performance of logging. Try reducing the level of nesting for the parameter objects.`,
            arg,
          );
        }
      });
    } catch (error) {
      console.warn(
        `Arg nesting too deep. This will affect the performance of logging. Try reducing the level of nesting for the parameter objects.`,
        argsNew,
      );
    }
  }
  const stringifiedLog = safeStringify(argsNew);

  return stringifiedLog.length > LOG_STRING_LIMIT
    ? `${stringifiedLog.slice(0, LOG_STRING_LIMIT)}...(truncated)`
    : stringifiedLog;
}

function logToConsole(props: IConsoleFuncProps) {
  if (platformEnv.isJest) {
    return;
  }
  if (IS_DEV) {
    const prefix = `${[
      fnsFormat(new Date(), 'HH:mm:ss'), // 'HH:mm:ss.SSS'
      props?.extension || '',
      props?.level?.text || '',
    ]
      .filter(Boolean)
      .join(' | ')} : `;
    let logContent = [prefix];
    if (props?.rawMsg && isArray(props.rawMsg)) {
      logContent = [...logContent, ...props.rawMsg];
    }
    if (props?.level?.text === 'error') {
      console.error(...logContent);
    } else {
      console.log(...logContent);
    }
  }
}

function logToFile(msg: string, props: IConsoleFuncProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { level, rawMsg, extension } = props;

  // write logger to file
  if (platformEnv.isNative) {
    FileLogger.write(level?.severity || LogLevel.Info, `${msg}`);
  } else {
    global.$backgroundApiProxy?.serviceApp?.addLogger?.(`${msg}\r\n`);
  }
}

let prevLogContent: string | undefined;
let repeatContentCount = 0;
const consoleFunc = (msg: string, props: IConsoleFuncProps) => {
  if (IS_DEV) {
    logToConsole(props);
  }
  const logContent =
    props?.rawMsg && isArray(props.rawMsg) ? props.rawMsg.join('') : '';
  if (logContent === prevLogContent) {
    repeatContentCount += 1;
    return;
  }

  if (repeatContentCount > 0) {
    const message = `------> (${repeatContentCount + 1}) ${
      prevLogContent || ''
    }`;
    repeatContentCount = 0;
    consoleFunc(message, {
      ...props,
      msg: message,
      rawMsg: [message],
    });
  }

  prevLogContent = logContent;
  logToFile(msg, props);
};

const NATIVE_LOG_DIR_PATH = `${RNFS?.CachesDirectoryPath || 'OneKey'}/logs`;
const NATIVE_LOG_ZIP_DIR_PATH = `${
  RNFS?.CachesDirectoryPath || 'OneKey'
}/log_zip`;

const removeLogZipDir = async () => {
  if (!RNFS) return;
  const isExist = await RNFS.exists(NATIVE_LOG_ZIP_DIR_PATH);
  if (isExist) {
    await RNFS.unlink(NATIVE_LOG_ZIP_DIR_PATH);
  }
};

const createLogZipDir = async () => {
  if (!RNFS) return;
  await RNFS.mkdir(NATIVE_LOG_ZIP_DIR_PATH);
};

if (platformEnv.isNative) {
  FileLogger.configure({
    captureConsole: false,
    dailyRolling: true,
    maximumFileSize: 1024 * 1024 * 4,
    maximumNumberOfFiles: 7,
    logsDirectory: NATIVE_LOG_DIR_PATH,
    logLevel: LogLevel.Info,
  });
}

export const logger = RNLogger.createLogger({
  async: true,
  // eslint-disable-next-line @typescript-eslint/unbound-method
  asyncFunc: InteractionManager.runAfterInteractions,
  // stringifyFunc: stringifyLog, // not working, use convertMethod instead.
  dateFormat: 'time', // `time`, `local`, `utc`, `iso` or `(date: Date) => string`
  transport: [consoleTransport],
  transportOptions: {
    consoleFunc,
  },
});

export enum LoggerNames {
  onBoarding = 'onBoarding',
  hardwareSDK = 'hardwareSDK',
  http = 'http',
  websocket = 'websocket',
  jsBridge = 'jsBridge',
  webview = 'webview',
  desktopInjected = 'desktopInjected',
  ethereum = 'ethereum', // TODO rename injectedEthereum
  dappApprove = 'dappApprove', // TODO rename injectedEthereum
  extContentScripts = 'extContentScripts',
  extInjected = 'extInjected',
  backgroundApi = 'backgroundApi',
  walletConnect = 'walletConnect',
  deepLink = 'deepLink',
  accountSelector = 'accountSelector',
  engine = 'engine',
  sendTx = 'sendTx',
  navigation = 'navigation',
  redux = 'redux',
  common = 'common',
  cloudBackup = 'cloudBackup',
  swap = 'swap',
  providerApi = 'providerApi',
  notification = 'notification',
  autoUpdate = 'autoUpdate',
  migrate = 'migrate',
  onekeyLite = 'onekeyLite',
  native = 'native',
  staking = 'staking',
  allNetworks = 'allNetworks',

  flowApp = 'flowApp',
  flowError = 'flowError',
  flowChain = 'flowChain',
  flowSend = 'flowSend',
}

export type LoggerEntity = {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
};

export type LoggerEntityFull = {
  debug: (...args: any[]) => void;
  _debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  _info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  _warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  _error: (...args: any[]) => void;
};

const dangerouslyFlowLogMethodName = 'dangerouslyFlowLog' as any;

// eslint-disable-next-line @typescript-eslint/require-await
export async function dangerouslyLogInfo(
  loggerInstance: LoggerEntity,
  ...args: any[]
) {
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  return loggerInstance[dangerouslyFlowLogMethodName](...args);
}

const Cache = {
  createLogger(name: LoggerNames): LoggerEntity {
    const instance = logger.extend(name) as LoggerEntityFull;

    // stringifyFunc: stringifyLog, not working for iOS
    const buildCustomLogMethod = (methodName: keyof LoggerEntity) => {
      const defaultMethod = name === LoggerNames.flowError ? '_error' : '_info';
      instance[`_${methodName}`] =
        instance[
          methodName === dangerouslyFlowLogMethodName
            ? defaultMethod
            : methodName
        ];
      instance[methodName] = async (...args: any[]) => {
        if (isFlowLogger(name) && methodName !== dangerouslyFlowLogMethodName) {
          console.error(
            `calling debugLogger.${name}.${methodName}() directly is NOT allowed, please use flowLogger instead.`,
          );
          return;
        }

        // if settings init done and current logger is disabled, return ASAP.
        if (debugLoggerInitedDone && !debugLoggerSettingsCache[name]) {
          return;
        }

        // generate content first, so that the content won't change after await if Object modified.
        const content = stringifyLog(...args);

        if (!debugLoggerInitedDone && !platformEnv.isJest) {
          await waitForDataLoaded({
            data: () => debugLoggerInitedDone,
            wait: 1000,
            logName: `debugLogger custom log method: ${name} ${content}`,
            timeout: getTimeDurationMs({ minute: 1 }),
          });
        }

        if (!debugLoggerSettingsCache[name]) {
          return;
        }
        return instance[`_${methodName}`](content);
      };
    };

    buildCustomLogMethod('debug');
    buildCustomLogMethod('info');
    buildCustomLogMethod('warn');
    buildCustomLogMethod('error');
    buildCustomLogMethod(dangerouslyFlowLogMethodName);

    return instance;
  },
};

const debugLogger: Record<
  LoggerNames,
  ReturnType<typeof Cache.createLogger>
> = {
  // @ts-ignore
  stringifyLog,
  [LoggerNames.hardwareSDK]: Cache.createLogger(LoggerNames.hardwareSDK),
  [LoggerNames.onBoarding]: Cache.createLogger(LoggerNames.onBoarding),
  [LoggerNames.redux]: Cache.createLogger(LoggerNames.redux),
  [LoggerNames.navigation]: Cache.createLogger(LoggerNames.navigation),
  [LoggerNames.http]: Cache.createLogger(LoggerNames.http),
  [LoggerNames.websocket]: Cache.createLogger(LoggerNames.websocket),
  [LoggerNames.jsBridge]: Cache.createLogger(LoggerNames.jsBridge),
  [LoggerNames.webview]: Cache.createLogger(LoggerNames.webview),
  [LoggerNames.desktopInjected]: Cache.createLogger(
    LoggerNames.desktopInjected,
  ),
  [LoggerNames.ethereum]: Cache.createLogger(LoggerNames.ethereum),
  [LoggerNames.dappApprove]: Cache.createLogger(LoggerNames.dappApprove),
  [LoggerNames.extContentScripts]: Cache.createLogger(
    LoggerNames.extContentScripts,
  ),
  [LoggerNames.extInjected]: Cache.createLogger(LoggerNames.extInjected),
  [LoggerNames.backgroundApi]: Cache.createLogger(LoggerNames.backgroundApi),
  [LoggerNames.walletConnect]: Cache.createLogger(LoggerNames.walletConnect),
  [LoggerNames.deepLink]: Cache.createLogger(LoggerNames.deepLink),
  [LoggerNames.accountSelector]: Cache.createLogger(
    LoggerNames.accountSelector,
  ),
  [LoggerNames.engine]: Cache.createLogger(LoggerNames.engine),
  [LoggerNames.sendTx]: Cache.createLogger(LoggerNames.sendTx),
  [LoggerNames.common]: Cache.createLogger(LoggerNames.common),
  [LoggerNames.cloudBackup]: Cache.createLogger(LoggerNames.cloudBackup),
  [LoggerNames.swap]: Cache.createLogger(LoggerNames.swap),
  [LoggerNames.providerApi]: Cache.createLogger(LoggerNames.providerApi),
  [LoggerNames.notification]: Cache.createLogger(LoggerNames.notification),
  [LoggerNames.autoUpdate]: Cache.createLogger(LoggerNames.autoUpdate),
  [LoggerNames.migrate]: Cache.createLogger(LoggerNames.migrate),
  [LoggerNames.onekeyLite]: Cache.createLogger(LoggerNames.onekeyLite),
  [LoggerNames.native]: Cache.createLogger(LoggerNames.native),
  [LoggerNames.staking]: Cache.createLogger(LoggerNames.staking),
  [LoggerNames.allNetworks]: Cache.createLogger(LoggerNames.allNetworks),

  [LoggerNames.flowApp]: Cache.createLogger(LoggerNames.flowApp),
  [LoggerNames.flowError]: Cache.createLogger(LoggerNames.flowError),
  [LoggerNames.flowChain]: Cache.createLogger(LoggerNames.flowChain),
  [LoggerNames.flowSend]: Cache.createLogger(LoggerNames.flowSend),
};

if (IS_DEV) {
  // internal console
  global.$$debugLogger = debugLogger;
}

if (platformEnv.isNative) {
  const removePreviousLogFile = async () => {
    try {
      if (!RNFS) return;
      const filePath = `${RNFS.CachesDirectoryPath ?? ''}log.txt`;
      await RNFS.unlink(filePath);
      debugLogger.backgroundApi.info('previous log file deleted at init');
    } catch (e) {
      // ignore
    }
  };
  removePreviousLogFile();
}

const DEBUG_LOGGER_STORAGE_KEY = '$$ONEKEY_DEBUG_LOGGER';

const shouldUseLocalStorage =
  platformEnv.isDesktop ||
  platformEnv.isWeb ||
  platformEnv.isJest ||
  platformEnv.isExtensionOffscreen; // offscreen can't access chrome extension storage

/* TODO cross-inpage-provider 支持关闭所有日志
  if (namespaces) {
      await exportsBrowser.storage.setItem(storageKey, namespaces);
    } else {
      // setItem if namespaces === '' otherwise removeItem
      await exportsBrowser.storage.removeItem(storageKey);
    }

    // UI 层不判断origin错误
    let origin = utils.getOriginFromPort(port0) || '';
                // in ext ui, port.sender?.origin is always empty,
                //    so we trust remote (background) origin
  */
async function getDebugLoggerSettings(): Promise<string | undefined | null> {
  if (shouldUseLocalStorage) {
    return window.localStorage.getItem(DEBUG_LOGGER_STORAGE_KEY);
  }
  return appStorage.getItem(DEBUG_LOGGER_STORAGE_KEY);
}

export function toggleLoggerExtensionEnable({
  name,
  enable,
}: {
  name: string;
  enable: boolean;
}) {
  if (enable) {
    logger.enable(name);
  } else {
    // should enabled() first to create _enabledExtensions array,
    //    otherwise logger.enable() logger.disable() won't working.
    logger.enable(name);
    logger.disable(name);
  }

  debugLoggerSettingsCache[name] = enable;
}

async function loadDebugLoggerSettings() {
  if (platformEnv.isJest) {
    return;
  }
  let enabledKeys: string[] = [];
  if (IS_DEV) {
    const enabledKeysStr = await getDebugLoggerSettings();
    if (isNil(enabledKeysStr)) {
      enabledKeys = [LoggerNames.common, LoggerNames.flowError];
    } else {
      enabledKeys = enabledKeysStr.split(',').filter(Boolean);
    }
  }

  const devModeInfo = await devModeUtils.getDevModeInfoAsync();

  Object.keys(LoggerNames).forEach((key) => {
    let shouldEnable = false;

    if (IS_DEV) {
      shouldEnable = enabledKeys.includes(key);
    }

    if (IS_PRD) {
      // only log flowLogger on production
      shouldEnable = !!devModeInfo?.enable || isFlowLogger(key);
    }

    toggleLoggerExtensionEnable({
      name: key,
      enable: shouldEnable,
    });
  });
}

async function saveDebugLoggerSettings() {
  if (platformEnv.isJest) {
    return;
  }
  if (IS_PRD) {
    return;
  }
  const enabledKeys: string[] = (logger._enabledExtensions as any) || [];
  const enabledKeysStr = enabledKeys.join(',');
  if (shouldUseLocalStorage) {
    window.localStorage.setItem(DEBUG_LOGGER_STORAGE_KEY, enabledKeysStr);
  } else {
    await appStorage.setItem(DEBUG_LOGGER_STORAGE_KEY, enabledKeysStr);
  }
  console.log('saveDebugLoggerSettings >>>>> ', enabledKeysStr);
}

export async function initDebugLoggerSettings() {
  await loadDebugLoggerSettings();
  await saveDebugLoggerSettings();
  debugLoggerInitedDone = true;
}

initDebugLoggerSettings();

export async function logDeviceInfo() {
  const info = [
    `Device: ${getModel()} ${getDeviceId()}`,
    `System: ${getSystemName()} ${getSystemVersion()}`,
    `Version Hash: ${process.env.COMMITHASH || ''}`,
    `Build Number: ${getBuildNumber()} ${getIncrementalSync()}`,
    `Memory: ${getUsedMemorySync()}/${getTotalMemorySync()}`,
  ];
  await dangerouslyLogInfo(debugLogger.flowApp, '🅳🅴🆅🅸🅲🅴 🅸🅽🅵🅾:', info);
}

export const getLogZipPath = async (fileName: string) => {
  try {
    if (!RNFS) return;
    await removeLogZipDir();
    await createLogZipDir();
    const distLogPath = `${NATIVE_LOG_ZIP_DIR_PATH}/${fileName}`;
    await zip(NATIVE_LOG_DIR_PATH, `${NATIVE_LOG_ZIP_DIR_PATH}/${fileName}`);
    if (!(await RNFS.exists(distLogPath))) {
      throw new Error('zip log path is not exist');
    }
    return platformEnv.isNativeAndroid ? `file://${distLogPath}` : distLogPath;
  } catch (e) {
    if (!RNFS) return;
    const files = await RNFS.readDir(NATIVE_LOG_DIR_PATH);
    const sortedFiles = files
      .filter((f) => f.name.endsWith('.log'))
      .map((f) => ({
        ...f,
        time: new Date(f.mtime || f.ctime || '').getTime(),
      }))
      .sort((a, b) => b.time - a.time);
    return sortedFiles[0].path;
  }
};

// debugLogger.common.error(new Error('Log Sample Error in debugLogger'));

export { getDebugLoggerSettings, saveDebugLoggerSettings };
export default debugLogger;
