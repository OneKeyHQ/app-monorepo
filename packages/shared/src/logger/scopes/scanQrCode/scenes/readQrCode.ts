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

  @LogToLocal({ level: 'info' })
  public scanButtonPressed() {}

  @LogToLocal({ level: 'info' })
  public pasteButtonPressed() {}

  @LogToLocal({ level: 'info' })
  public eyeTogglePressed(params: { encrypted: boolean }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public scanCallbackFired(params: { valueLength: number }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public scanPromiseResolved(params: {
    rawLength: number;
    type: string;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public inputOnChangeTextCalled(params: {
    rawLength: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public handleChangeTextCalled(params: {
    textLength: number;
    encrypted: boolean;
    hasDot: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public updatePrivateKeyCalled(params: {
    textLength: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public formattedValueComputed(params: {
    encrypted: boolean;
    privateKeyLength: number;
    formattedValueLength: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public setNativePropsAttempt(params: {
    displayTextLength: number;
    encrypted: boolean;
    hasSetNativeProps: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public renderWithValue(params: {
    formattedValueLength: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public parseQrCodeStart(params: { valueLength: number }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public parseQrCodeResult(params: {
    type: string;
    rawLength: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public closeScanPageStart(params: { autoExecute: boolean }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public closeScanPageDone() {}

  @LogToLocal({ level: 'info' })
  public scanPromiseResolvedInModal(params: {
    rawLength: number;
    type: string;
  }) {
    return params;
  }
}
