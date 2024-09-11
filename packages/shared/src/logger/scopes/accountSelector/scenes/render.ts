import { BaseScene } from '../../../base/baseScene';
import { LogToConsole } from '../../../base/decorators';

export class AccountSelectorRenderScene extends BaseScene {
  @LogToConsole()
  public selectAccount(params: {
    accountId: string;
    networkId: string;
    walletId: string;
  }) {
    return params;
  }

  @LogToConsole()
  public showAccountSelector(p: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return ['showAccountSelector', p];
  }
}
