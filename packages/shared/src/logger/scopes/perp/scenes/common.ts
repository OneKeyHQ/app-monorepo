import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

export class CommonScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public placeOrder({
    builderAddress,
    builderFee,
    grouping,
    orders,
    nonce,
  }: {
    builderAddress: string;
    builderFee: number;
    grouping: string;
    orders: object[];
    nonce: number;
  }) {
    const result = {
      builder: {
        b: builderAddress,
        f: builderFee,
      },
      grouping,
      orders,
      nonce,
    };
    return result;
  }
}
