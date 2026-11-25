import { BaseScene } from '../../../base/baseScene';
import { LogToLocal, LogToServer } from '../../../base/decorators';

import type {
  EPerpPageEnterSource,
  IPerpAccountStatusParams,
  IPerpShareActionClickParams,
  IPerpShareParams,
  IPerpTradeButtonClickParams,
} from '../type';

export class CommonScene extends BaseScene {
  /** Track the entry click before preparing share data. */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpShareClick(params: IPerpShareParams) {
    return params;
  }

  /** Track each share dialog opening once. */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpShareDialogOpen(params: IPerpShareParams) {
    return params;
  }

  /** Track action intent, not successful delivery to a share destination. */
  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpShareActionClick(params: IPerpShareActionClickParams) {
    return params;
  }

  @LogToServer()
  @LogToLocal({ level: 'info' })
  public perpPageView({
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
  public perpAccountStatus(params: IPerpAccountStatusParams) {
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
