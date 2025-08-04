import type { EHardwareTransportType } from '@onekeyhq/shared/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';
import utils from '../../../utils';

export class DeviceScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public logDeviceInfo() {
    return utils.getDeviceInfo();
  }

  @LogToLocal()
  public setForceTransportType({
    forceTransportType,
    operationId,
  }: {
    forceTransportType: EHardwareTransportType;
    operationId: string;
  }) {
    return {
      forceTransportType,
      operationId,
    };
  }

  @LogToLocal()
  public clearForceTransportType() {
    return {};
  }
}
