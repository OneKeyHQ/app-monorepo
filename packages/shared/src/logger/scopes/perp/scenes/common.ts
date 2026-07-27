import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type {
  EPerpPageEnterSource,
  IPerpTradeButtonClickParams,
} from '../type';

export class CommonScene extends BaseScene {
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public pageView({
    source,
    walletType,
  }: {
    source: EPerpPageEnterSource;
    walletType: string;
  }) {
    return { source, walletType, pageName: 'Perp' };
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpTradeButtonClick(params: IPerpTradeButtonClickParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpWebviewPlaceOrder({
    userAddress,
    chainId,
    builderAddress,
    builderFee,
    grouping,
    orders,
    nonce,
    errorMessage,
    walletType,
    status,
    errorCode,
  }: {
    userAddress: string;
    chainId: string;
    builderAddress: string;
    builderFee: number;
    grouping: string;
    orders: object[];
    nonce: number;
    errorMessage: string;
    walletType: string;
    status: 'success' | 'fail';
    errorCode?: string;
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
      walletType,
      status,
      errorCode,
    };
    return result;
  }
}
