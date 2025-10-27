import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

export class BtcFreshAddressScene extends BaseScene {
  @LogToLocal({ level: 'debug' })
  public debugLog({
    stage,
    detail,
  }: {
    stage: string;
    detail?: Record<string, any>;
  }) {
    return `btcFreshAddress:${stage}${
      detail ? ` ${JSON.stringify(detail)}` : ''
    }`;
  }
}
