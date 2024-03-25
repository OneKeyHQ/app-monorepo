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

import {
  FileLogger,
  LogLevel,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import { zip } from '@onekeyhq/shared/src/modules3rdParty/react-native-zip-archive';

import platformEnv from '../../platformEnv';

const NATIVE_LOG_DIR_PATH = `${RNFS?.CachesDirectoryPath || 'OneKey'}/logs`;
const NATIVE_LOG_ZIP_PATH = `${RNFS?.CachesDirectoryPath || 'OneKey'}/logs_zip`;

void FileLogger.configure({
  captureConsole: false,
  dailyRolling: true,
  formatter: (_, msg: string) => msg,
  maximumFileSize: 1024 * 1024 * 2, // 2MB
  maximumNumberOfFiles: 2,
  logsDirectory: NATIVE_LOG_DIR_PATH,
  logLevel: LogLevel.Info,
});

export const consoleFunc = (msg: string) => {
  console.log(msg);
  FileLogger.write(LogLevel.Info, msg);
};

export const getLogFilePath = async (filename: string) => {
  if (!RNFS) {
    throw new Error('RNFS is not available');
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

export const getDeviceInfo = () =>
  [
    `Device: ${getModel()} ${getDeviceId()}`,
    `System: ${getSystemName()} ${getSystemVersion()}`,
    `Version Hash: ${process.env.COMMITHASH || ''}`,
    `Build Number: ${getBuildNumber()} ${getIncrementalSync()}`,
    `Memory: ${getUsedMemorySync()}/${getTotalMemorySync()}`,
    `appPlatform: ${platformEnv.appPlatform ?? ''}`,
    `appChannel: ${platformEnv.appChannel ?? ''}`,
    `buildNumber: ${platformEnv.buildNumber ?? ''}`,
    `version: ${platformEnv.version ?? ''}`,
  ].join(',');
