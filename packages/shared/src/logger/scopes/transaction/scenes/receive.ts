import type { EExchangeId } from '@onekeyhq/shared/src/consts/exchangeConsts';

import { BaseScene } from '../../../base/baseScene';
import { LogToServer } from '../../../base/decorators';

import type { IWalletActionSource } from '../../wallet/scenes/walletActions';

export type IReceiveExchangeSource = EExchangeId | 'others';
export type IReceiveEventSource = IWalletActionSource | 'unknown';
export type IReceiveSelectTab = 'token' | 'network';

export class ReceiveScene extends BaseScene {
  @LogToServer()
  public showReceived({
    walletType,
    isSuccess,
    failedReason,
  }: {
    walletType: string | undefined;
    isSuccess: boolean;
    failedReason: string | undefined;
  }) {
    return {
      walletType,
      isSuccess,
      failedReason,
    };
  }

  // Event names are global (method name only): the home page already owns
  // switchNetwork / switchTab, so every Receive event carries the prefix.

  // Reported once per resolved network on the QR page: on entry and after
  // every in-page switch. `showReceived` stays the verification event.
  @LogToServer()
  public receivePageShown(params: {
    networkId: string;
    source: IReceiveEventSource;
    switched: boolean;
    walletType: string | undefined;
    isAllNetworksMode: boolean | undefined;
  }) {
    return params;
  }

  @LogToServer()
  public receiveSwitchNetwork(params: {
    fromNetworkId: string;
    toNetworkId: string;
    source: IReceiveEventSource;
    // aggregate: the token's multi-chain members; all: every wallet network.
    listType: 'aggregate' | 'all';
    walletType: string | undefined;
    deviceType: string | undefined;
    createdAddress: boolean;
    isAllNetworksMode: boolean | undefined;
  }) {
    return params;
  }

  @LogToServer()
  public receiveSelectNetworkTab(params: {
    networkId: string;
    section: 'popular' | 'alpha';
    action: 'open' | 'create' | 'invoice';
    hasAddress: boolean;
    isSearchMode: boolean;
    walletType: string | undefined;
  }) {
    return params;
  }

  @LogToServer()
  public receiveSwitchTab(params: {
    fromTab: IReceiveSelectTab;
    toTab: IReceiveSelectTab;
  }) {
    return params;
  }

  @LogToServer()
  public clickExchangeEntry({
    exchangeSource,
    walletType,
  }: {
    exchangeSource: IReceiveExchangeSource;
    walletType: string | undefined;
  }) {
    return {
      exchangeSource,
      walletType,
    };
  }
}
