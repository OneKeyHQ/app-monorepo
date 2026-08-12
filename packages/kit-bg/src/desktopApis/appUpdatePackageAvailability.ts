import fs from 'fs';

import type { IAppUpdatePackageAvailability } from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';
import {
  EAppUpdatePackageAvailabilityStatus,
  EAppUpdatePackageErrorCode,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';

export function getDownloadedFileAvailability(
  downloadedFile?: string,
  options?: {
    requireCurrentProcessPreparation?: boolean;
    preparedDownloadedFile?: string;
  },
): IAppUpdatePackageAvailability {
  if (!downloadedFile) {
    return {
      status: EAppUpdatePackageAvailabilityStatus.missing,
    };
  }
  try {
    const pathStat = fs.lstatSync(downloadedFile);
    if (!pathStat.isFile() || pathStat.size <= 0) {
      return {
        status: EAppUpdatePackageAvailabilityStatus.missing,
      };
    }
    const noFollowFlag = fs.constants.O_NOFOLLOW ?? 0;
    const fileDescriptor = fs.openSync(
      downloadedFile,
      fs.constants.O_RDONLY | noFollowFlag,
    );
    let openedFileStat: fs.Stats;
    try {
      openedFileStat = fs.fstatSync(fileDescriptor);
    } finally {
      fs.closeSync(fileDescriptor);
    }
    if (
      !openedFileStat.isFile() ||
      openedFileStat.size <= 0 ||
      openedFileStat.dev !== pathStat.dev ||
      openedFileStat.ino !== pathStat.ino
    ) {
      return {
        status: EAppUpdatePackageAvailabilityStatus.missing,
      };
    }
    if (
      options?.requireCurrentProcessPreparation &&
      options.preparedDownloadedFile !== downloadedFile
    ) {
      return {
        status: EAppUpdatePackageAvailabilityStatus.unavailable,
        errorCode: EAppUpdatePackageErrorCode.packageNotPrepared,
      };
    }
    return { status: EAppUpdatePackageAvailabilityStatus.available };
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException)?.code;
    if (errorCode === 'ENOENT' || errorCode === 'ENOTDIR') {
      return {
        status: EAppUpdatePackageAvailabilityStatus.missing,
      };
    }
    return {
      status: EAppUpdatePackageAvailabilityStatus.unavailable,
      errorCode: errorCode || EAppUpdatePackageErrorCode.packageUnavailable,
    };
  }
}
