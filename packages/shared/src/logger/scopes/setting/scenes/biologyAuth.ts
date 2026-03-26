import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class BiologyAuthScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public isSupportBiologyAuth(params: {
    hasHardware: boolean;
    isEnrolled: boolean;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public authInfoAtomComputed(params: {
    isSupport: boolean;
    isBiologyAuthSwitchOn: boolean;
    isEnable: boolean;
    authType: string;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public listItemVisibility(params: {
    isPasswordSet: boolean;
    biologyAuthIsSupport: boolean;
    webAuthIsSupport: boolean;
    shouldShow: boolean;
  }) {
    return params;
  }
}
