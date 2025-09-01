import type { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

type IWalletActionBaseParams = {
  walletType: string;
  networkId: string;
  source:
    | 'homePage'
    | 'tokenDetails'
    | 'homeTokenList'
    | 'earn'
    | 'swap'
    | 'accountSelector';
  isSoftwareWalletOnlyUser: boolean;
};

export class WalletActionsScene extends BaseScene {
  @LogToServer()
  public actionBuy(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionSell(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionTrade(
    params: IWalletActionBaseParams & {
      tradeType: ESwapTabSwitchType;
    },
  ) {
    return params;
  }

  @LogToServer()
  public actionSend(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionReceive(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionEarn(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionCopyAddress(params: IWalletActionBaseParams) {
    return params;
  }

  @LogToServer()
  public actionViewInExplorer(
    params: Omit<IWalletActionBaseParams, 'isSoftwareWalletOnlyUser'>,
  ) {
    return params;
  }

  @LogToServer()
  public actionExportPublicKey(
    params: Omit<IWalletActionBaseParams, 'isSoftwareWalletOnlyUser'>,
  ) {
    return params;
  }

  @LogToServer()
  public actionExportXpub(
    params: Omit<IWalletActionBaseParams, 'isSoftwareWalletOnlyUser'>,
  ) {
    return params;
  }

  @LogToServer()
  public actionExportPrivateKey(
    params: Omit<IWalletActionBaseParams, 'isSoftwareWalletOnlyUser'>,
  ) {
    return params;
  }

  @LogToServer()
  public actionExportXprvt(
    params: Omit<IWalletActionBaseParams, 'isSoftwareWalletOnlyUser'>,
  ) {
    return params;
  }

  @LogToServer()
  public buyStarted({
    tokenAddress,
    tokenSymbol,
    networkID,
  }: {
    tokenAddress: string;
    tokenSymbol: string;
    networkID: string;
  }) {
    return {
      tokenAddress,
      tokenSymbol,
      networkID,
    };
  }

  @LogToServer()
  public switchNetwork({
    networkName,
    details,
  }: {
    networkName: string;
    details: {
      isCustomNetwork: boolean;
    };
  }) {
    return {
      networkName,
      details,
    };
  }
}
