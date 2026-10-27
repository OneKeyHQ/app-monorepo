import { LogToConsoleDevOnly } from '../../../base/decorators';

import { AccountSelectorDevOnlyScene } from './devOnlyScene';

export class AccountSelectorRenderScene extends AccountSelectorDevOnlyScene {
  @LogToConsoleDevOnly()
  public selectAccount(params: {
    accountId: string;
    networkId: string;
    walletId: string;
  }) {
    return {
      hasAccount: Boolean(params.accountId),
      hasNetwork: Boolean(params.networkId),
      hasWallet: Boolean(params.walletId),
    };
  }

  @LogToConsoleDevOnly()
  public showAccountSelector(payload: unknown) {
    return { hasPayload: payload !== undefined };
  }
}
