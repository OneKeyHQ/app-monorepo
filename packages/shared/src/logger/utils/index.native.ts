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
  LogLevel,
  NativeLogger,
} from '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs';
import { zip } from '@onekeyhq/shared/src/modules3rdParty/react-native-zip-archive';

import platformEnv from '../../platformEnv';

import type { IUtilsType } from './types';

const NATIVE_LOG_DIR_PATH = NativeLogger.getLogDirectory();
const NATIVE_LOG_ZIP_PATH = `${RNFS?.CachesDirectoryPath || 'OneKey'}/logs_zip`;

const consoleFunc = (msg: string) => {
  if (platformEnv.isDev) {
    // eslint-disable-next-line no-console
    console.log(msg);
  }
  NativeLogger.write(LogLevel.Info, msg);
};

const getLogFilePath = async (filename: string) => {
  if (!RNFS) {
    throw new OneKeyLocalError('RNFS is not available');
  }

  try {
    const isExist = await RNFS.exists(NATIVE_LOG_ZIP_PATH);
    if (!isExist) {
      await RNFS.mkdir(NATIVE_LOG_ZIP_PATH);
    }
    const filepath = await zip(
      NATIVE_LOG_DIR_PATH,
      `${NATIVE_LOG_ZIP_PATH}/${filename}.zip`,
    );
    return platformEnv.isNativeAndroid ? `file://${filepath}` : filepath;
  } catch (error) {
    // If zip fails, return the latest log file from NATIVE_LOG_DIR_PATH
    console.error(
      'Failed to zip logs, falling back to latest log file:',
      error,
    );

    const dirExists = await RNFS.exists(NATIVE_LOG_DIR_PATH);
    if (!dirExists) {
      throw new OneKeyLocalError('Log directory does not exist');
    }

    const files = await RNFS.readDir(NATIVE_LOG_DIR_PATH);
    if (files.length === 0) {
      throw new OneKeyLocalError('No log files found');
    }

    // Sort files by modification time (newest first)
    const sortedFiles = files
      .filter((file) => file.isFile())
      .toSorted((a, b) => {
        const timeA = new Date(a.mtime || 0).getTime();
        const timeB = new Date(b.mtime || 0).getTime();
        return timeB - timeA;
      });

    if (sortedFiles.length === 0) {
      throw new OneKeyLocalError('No log files found');
    }

    const latestFile = sortedFiles[0].path;
    return platformEnv.isNativeAndroid ? `file://${latestFile}` : latestFile;
  }
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
    `bundleVersion: ${platformEnv.bundleVersion ?? ''}`,
    `version: ${platformEnv.version ?? ''}`,
  ].join(',');

const utils: IUtilsType = { getDeviceInfo, getLogFilePath, consoleFunc };
export default utils;
