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
const RECOVERY_LOG_ARCHIVE_PATHS = [
  `${RNFS?.CachesDirectoryPath || 'OneKey'}/onekey_logs.zip`,
  `${RNFS?.TemporaryDirectoryPath || 'OneKey'}/onekey-logs.zip`,
];
const IOS_FILE_PROTECTION_OPTIONS = platformEnv.isNativeIOS
  ? { NSFileProtectionKey: 'NSFileProtectionComplete' }
  : {};

const normalizeFilePath = (filePath: string) =>
  filePath.startsWith('file://') ? filePath.slice('file://'.length) : filePath;

const cleanupLogArchives = async (createdBefore: number) => {
  const nativeFs = RNFS;
  if (!nativeFs) {
    return;
  }

  const removePreviousLaunchArchive = async (archivePath: string) => {
    if (!(await nativeFs.exists(archivePath))) {
      return;
    }
    const archiveStat = await nativeFs.stat(archivePath);
    const modifiedAt = new Date(archiveStat.mtime || 0).getTime();
    if (!Number.isFinite(modifiedAt) || modifiedAt <= createdBefore) {
      await nativeFs.unlink(archivePath).catch(() => {});
    }
  };

  if (await nativeFs.exists(NATIVE_LOG_ZIP_PATH)) {
    const archiveFiles = await nativeFs.readDir(NATIVE_LOG_ZIP_PATH);
    for (const file of archiveFiles) {
      if (file.isFile() && file.name.endsWith('.zip')) {
        await removePreviousLaunchArchive(file.path);
      }
    }
  }

  await Promise.all(
    RECOVERY_LOG_ARCHIVE_PATHS.map(removePreviousLaunchArchive),
  );
};

const consoleFunc = (msg: string) => {
  if (platformEnv.isDev) {
    // eslint-disable-next-line no-console
    console.log(msg);
  }
  // No JS-side dedup/truncation here — handled natively in OneKeyLog
  // (iOS: OneKeyLog.swift, Android: OneKeyLog.kt — dedup + rate-limit + truncate at 4096 chars)
  NativeLogger.write(LogLevel.Info, msg);
};

const getLogFilePath = async (filename: string) => {
  if (!RNFS) {
    throw new OneKeyLocalError('RNFS is not available');
  }

  const isExist = await RNFS.exists(NATIVE_LOG_ZIP_PATH);
  if (!isExist) {
    await RNFS.mkdir(NATIVE_LOG_ZIP_PATH, IOS_FILE_PROTECTION_OPTIONS);
  }
  const safeFilename = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  const archiveName = safeFilename || 'OneKeyLogs';
  const finalArchivePath = `${NATIVE_LOG_ZIP_PATH}/${archiveName}.zip`;
  const stagingArchivePath = `${NATIVE_LOG_ZIP_PATH}/${archiveName}.staging.zip`;
  let archivePath: string;
  try {
    await RNFS.unlink(finalArchivePath).catch(() => {});
    await RNFS.unlink(stagingArchivePath).catch(() => {});
    const filepath = await zip(NATIVE_LOG_DIR_PATH, stagingArchivePath);
    await RNFS.moveFile(
      filepath,
      finalArchivePath,
      IOS_FILE_PROTECTION_OPTIONS,
    );
    archivePath = finalArchivePath;
  } catch (error) {
    await RNFS.unlink(stagingArchivePath).catch(() => {});
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

  return platformEnv.isNativeAndroid ? `file://${archivePath}` : archivePath;
};

const removeLogFilePath = async (filePath: string) => {
  if (!RNFS) {
    return;
  }
  const normalizedPath = normalizeFilePath(filePath);
  const pathSegments = normalizedPath.split('/');
  if (
    pathSegments.includes('..') ||
    !normalizedPath.startsWith(`${NATIVE_LOG_ZIP_PATH}/`)
  ) {
    return;
  }
  if (await RNFS.exists(normalizedPath)) {
    await RNFS.unlink(normalizedPath).catch(() => {});
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

/** Flush pending dedup repeat summary in native OneKeyLog before log export. */
const flushPendingRepeat = () => {
  // Guard: flushPendingRepeat may not exist in older native-logger versions
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  if (typeof (NativeLogger as any).flushPendingRepeat === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (NativeLogger as any).flushPendingRepeat();
  }
};

const utils: IUtilsType = {
  getDeviceInfo,
  getLogFilePath,
  removeLogFilePath,
  cleanupLogArchives,
  consoleFunc,
  flushPendingRepeat,
};
export default utils;
