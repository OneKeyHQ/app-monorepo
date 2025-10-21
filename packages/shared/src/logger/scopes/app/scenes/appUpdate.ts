import type {
  EUpdateFileType,
  EUpdateStrategy,
  IResponseAppUpdateInfo,
} from '@onekeyhq/shared/src/appUpdate';
import type {
  IDownloadPackageParams,
  IUpdateDownloadedEvent,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class AppUpdateScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public startCheckForUpdates(
    fileType: EUpdateFileType,
    updateStrategy: EUpdateStrategy,
  ) {
    return {
      fileType,
      updateStrategy,
    };
  }

  @LogToLocal({ level: 'info' })
  public fetchConfig(updateInfo: IResponseAppUpdateInfo | undefined) {
    return updateInfo;
  }

  @LogToLocal({ level: 'info' })
  isNeedSyncAppUpdateInfo(isNeedSync: boolean) {
    return isNeedSync;
  }

  @LogToLocal({ level: 'info' })
  public startDownload(params: IDownloadPackageParams) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public endDownload(params: IUpdateDownloadedEvent) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public startVerifyPackage(params: IDownloadPackageParams) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public endVerifyPackage(success: boolean, error?: Error) {
    return { success, error: error?.message };
  }

  @LogToLocal({ level: 'info' })
  public startVerifyASC(params: IDownloadPackageParams) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public endVerifyASC(success: boolean, error?: Error) {
    return { success, error: error?.message };
  }

  @LogToLocal({ level: 'info' })
  public startDownloadASC(params: IDownloadPackageParams) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public endDownloadASC(success: boolean, error?: Error) {
    return { success, error: error?.message };
  }

  @LogToLocal({ level: 'info' })
  public startInstallPackage(params: unknown) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public endInstallPackage(success: boolean, error?: Error) {
    return { success, error: error?.message };
  }

  @LogToLocal({ level: 'info' })
  public startManualInstallPackage(params: unknown) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public endManualInstallPackage(success: boolean, error?: Error) {
    return { success, error: error?.message };
  }

  @LogToLocal({ level: 'info' })
  public startCheckForUpdatesOnly() {
    return {};
  }

  @LogToLocal({ level: 'info' })
  public endCheckForUpdates(result: {
    isNeedUpdate: boolean;
    isForceUpdate: boolean;
    updateFileType?: string;
  }) {
    return result;
  }

  @LogToLocal({ level: 'info' })
  public isInstallFailed(
    previousBuildNumber: string,
    currentBuildNumber: string,
  ) {
    return { previousBuildNumber, currentBuildNumber };
  }
}
