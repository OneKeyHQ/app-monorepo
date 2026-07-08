import { BaseScene } from '../../../base/baseScene';
import { LogToConsole, LogToLocal } from '../../../base/decorators';

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

  @LogToLocal()
  public homePageState(params: {
    ready: boolean;
    walletId: string | undefined;
    indexedAccountId: string | undefined;
    networkId: string | undefined;
    deriveType: string | undefined;
    hasAccount: boolean;
    hasDbAccount: boolean;
    hasWallet: boolean;
    hasIndexedAccount: boolean;
    hasNetwork: boolean;
    hasNoUsableWallet: boolean;
    showNoWalletContent: boolean;
    accountSelectorStorageInitDone: boolean;
    accountSelectorActiveAccountInitDone: boolean;
    walletListResolvedNoWallet: boolean;
    walletListCount: number | undefined;
    accountNetworkNotSupported: boolean | undefined;
    contentState: 'loading' | 'noWallet' | 'wallet' | 'blankNoUsableWallet';
  }) {
    return params;
  }
}
