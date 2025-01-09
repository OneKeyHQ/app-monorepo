import { devOnlyData } from '@onekeyhq/shared/src/utils/devModeUtils';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class ReadQrCodeScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public releaseCamera() {}

  @LogToLocal({ level: 'info' })
  public readFromCamera(value: string) {
    return devOnlyData(value);
  }

  @LogToLocal({ level: 'info' })
  public readFromLibrary(imageResult: string, stringResult: string | null) {
    return devOnlyData({ imageResult, stringResult });
  }
}
