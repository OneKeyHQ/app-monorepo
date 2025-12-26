import {
  deviceType,
  isDevice,
  manufacturer,
  modelName,
  osName,
  osVersion,
  supportedCpuArchitectures,
  totalMemory,
} from 'expo-device';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  isDualScreenDevice,
  isRawSpanning,
} from '@onekeyhq/shared/src/modules/DualScreenInfo';
import {
  FileLogger,
  LogLevel,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import { zip } from '@onekeyhq/shared/src/modules3rdParty/react-native-zip-archive';

import platformEnv from '../../platformEnv';

import type { IUtilsType } from './types';

const NATIVE_LOG_DIR_PATH = `${RNFS?.CachesDirectoryPath || 'OneKey'}/logs`;
const NATIVE_LOG_ZIP_PATH = `${RNFS?.CachesDirectoryPath || 'OneKey'}/logs_zip`;

void FileLogger.configure({
  captureConsole: false,
  dailyRolling: true,
  formatter: (_, msg: string) => msg,
  maximumFileSize: 1024 * 1024 * 20,
  maximumNumberOfFiles: 3,
  logsDirectory: NATIVE_LOG_DIR_PATH,
  logLevel: LogLevel.Info,
});

const consoleFunc = (msg: string) => {
  if (platformEnv.isDev) {
    // eslint-disable-next-line no-console
    console.log(msg);
  }
  FileLogger.write(LogLevel.Info, msg);
};

const getLogFilePath = async (filename: string) => {
  if (!RNFS) {
    throw new OneKeyLocalError('RNFS is not available');
  }
  const isExist = await RNFS.exists(NATIVE_LOG_ZIP_PATH);
  if (!isExist) {
    await RNFS.mkdir(NATIVE_LOG_ZIP_PATH);
  }
  const filepath = await zip(
    NATIVE_LOG_DIR_PATH,
    `${NATIVE_LOG_ZIP_PATH}/${filename}.zip`,
  );
  return platformEnv.isNativeAndroid ? `file://${filepath}` : filepath;
};

const getDeviceInfo = () =>
  [
    `Device: ${manufacturer ?? ''} ${modelName ?? ''}`,
    `System: ${osName ?? ''} ${osVersion ?? ''}`,
    `isDevice: ${isDevice ? 1 : 0}`,
    `deviceType: ${deviceType ?? ''}`,
    `isDualScreenDevice: ${isDualScreenDevice() ? 1 : 0}`,
    `isSpanning: ${isRawSpanning() ? 1 : 0}`,
    `arch: ${supportedCpuArchitectures?.join(',') ?? ''}`,
    `Version Hash: ${process.env.COMMITHASH || ''}`,
    `Memory: ${totalMemory ?? 0}`,
    `appPlatform: ${platformEnv.appPlatform ?? ''}`,
    `appChannel: ${platformEnv.appChannel ?? ''}`,
    `buildNumber: ${platformEnv.buildNumber ?? ''}`,
    `version: ${platformEnv.version ?? ''}`,
  ].join(',');

const utils: IUtilsType = { getDeviceInfo, getLogFilePath, consoleFunc };
export default utils;
