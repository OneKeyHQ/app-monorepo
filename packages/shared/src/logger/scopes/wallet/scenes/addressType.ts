import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

export class AddressTypeScene extends BaseScene {
  @LogToServer()
  public addressTypeSelected({
    networkId,
    type,
  }: {
    networkId: string;
    type: string;
  }) {
    return {
      networkId,
      type,
    };
  }
}
