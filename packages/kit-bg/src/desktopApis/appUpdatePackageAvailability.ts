import fs from 'fs';

import type { IAppUpdatePackageAvailability } from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';
import {
  EAppUpdatePackageAvailabilityStatus,
  EAppUpdatePackageErrorCode,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';

export function getDownloadedFileAvailability(
  downloadedFile?: string,
): IAppUpdatePackageAvailability {
  if (!downloadedFile) {
    return {
      status: EAppUpdatePackageAvailabilityStatus.missing,
    };
  }
  try {
    const stat = fs.statSync(downloadedFile);
    if (!stat.isFile() || stat.size <= 0) {
      return {
        status: EAppUpdatePackageAvailabilityStatus.missing,
      };
    }
    return {
      status: EAppUpdatePackageAvailabilityStatus.available,
    };
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
