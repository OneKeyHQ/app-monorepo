import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../decorators';

export class ValidationScene extends BaseScene {
  @LogToLocal({ level: 'error' })
  public failWithUnknownError({
    networkId,
    address,
  }: {
    networkId: string;
    address: string;
  }) {
    return [networkId, address];
  }
}
