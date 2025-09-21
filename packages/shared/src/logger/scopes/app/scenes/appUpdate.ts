import type {
  EUpdateFileType,
  EUpdateStrategy,
} from '@onekeyhq/shared/src/appUpdate';
import type { IDownloadPackageParams, IUpdateDownloadedEvent } from '@onekeyhq/shared/src/modules3rdParty/auto-update';

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
  public startDownload(params: IDownloadPackageParams) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public endDownload(params: IUpdateDownloadedEvent) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public startVerify() {}

  @LogToLocal({ level: 'info' })
  public endVerify() {}
}
