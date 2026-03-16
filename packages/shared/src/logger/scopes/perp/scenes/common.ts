import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type { EPerpPageEnterSource } from '../type';

export class CommonScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public pageView({ source }: { source: EPerpPageEnterSource }) {
    return { source, pageName: 'Perp' };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public placeOrder({
    userAddress,
    chainId,
    builderAddress,
    builderFee,
    grouping,
    orders,
    nonce,
    errorMessage,
  }: {
    userAddress: string;
    chainId: string;
    builderAddress: string;
    builderFee: number;
    grouping: string;
    orders: object[];
    nonce: number;
    errorMessage: string;
  }) {
    void userAddress;
    const result = {
      chainId,
      builder: {
        b: builderAddress,
        f: builderFee,
      },
      grouping,
      orders,
      nonce,
      errorMessage,
    };
    return result;
  }
}
