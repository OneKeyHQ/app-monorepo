import type { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';

import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

// Entry that opened the action. Also carried by the Receive QR page so its
// own events (receivePageShown / receiveSwitchNetwork) can be split by entry.
export type IWalletActionSource =
  | 'homePage'
  | 'receiveSelector'
  | 'tokenDetails'
  | 'homeTokenList'
  | 'homePopularTrading'
  | 'earn'
  | 'swap'
  | 'accountSelector'
  | 'network'
  | 'exchange'
  | 'copyAddress'
  | 'borrow'
  | 'perp'
  | 'rewardCenter'
  | 'bulkSend'
  | 'approval';

export type IWalletActionBaseParams = {
  walletType: string;
  networkId: string;
  source: IWalletActionSource;
  // Optional sub-UI marker within `source`. Currently used by home-page
  // Receive to distinguish the collapsed Add-Money CTA from the full row,
  // so analytics can compare conversion between the two variants.
  variant?: 'home_add_money' | 'home_full_row';
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
  public actionVote(
    params: Omit<IWalletActionBaseParams, 'isSoftwareWalletOnlyUser'>,
  ) {
    return params;
  }

  @LogToServer()
  public actionApprovals(
    params: Omit<IWalletActionBaseParams, 'isSoftwareWalletOnlyUser'>,
  ) {
    return params;
  }

  @LogToServer()
  public actionStaking(params: IWalletActionBaseParams) {
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

  @LogToServer()
  public zeroNativeBalanceDialog({
    action,
    networkId,
    tokenSymbol,
    walletType,
    sendFlowId,
  }: {
    action: 'shown' | 'receive' | 'buy' | 'continue';
    networkId: string;
    tokenSymbol: string;
    walletType: string;
    sendFlowId?: string;
  }) {
    return { action, networkId, tokenSymbol, walletType, sendFlowId };
  }

  @LogToServer()
  public buyOnLowBalance({
    source,
    networkId,
    tokenSymbol,
    tokenAddress,
    walletType,
  }: {
    source: 'swap' | 'perp';
    networkId: string;
    tokenSymbol: string;
    tokenAddress: string;
    walletType: string;
  }) {
    return {
      source,
      networkId,
      tokenSymbol,
      tokenAddress,
      walletType,
    };
  }
}
