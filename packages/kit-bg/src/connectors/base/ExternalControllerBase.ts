import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import type { IWalletConnectChainInfo } from '@onekeyhq/shared/src/walletConnect/types';
import type {
  IExternalConnectWalletResult,
  IExternalConnectionInfo,
  IExternalConnector,
  IExternalCreateConnectorResult,
  IExternalListWalletsResult,
} from '@onekeyhq/shared/types/externalWallet.types';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IDBExternalAccount } from '../../dbs/local/types';
import type {
  ISignMessageParams,
  ISignTransactionParams,
} from '../../vaults/types';
import type { ExternalConnectorWalletConnect } from '../chains/walletconnect/ExternalConnectorWalletConnect';
import type { ExternalWalletFactory } from '../externalWalletFactory';

export type IExternalHandleWalletConnectEventsParams = {
  eventName: string;
  eventData: any;
  wcChainInfo: IWalletConnectChainInfo;
  account: IDBExternalAccount;
};

export type IExternalSendTransactionByWalletConnectPayload = {
  account: IDBExternalAccount;
  networkId: string;
  params: ISignTransactionParams;
  connector: ExternalConnectorWalletConnect;
};

export type IExternalSendTransactionPayload = {
  account: IDBExternalAccount;
  networkId: string;
  params: ISignTransactionParams;
  connector: IExternalConnector;
};

export type IExternalSignMessageByWalletConnectPayload = {
  account: IDBExternalAccount;
  networkId: string;
  params: ISignMessageParams;
  connector: ExternalConnectorWalletConnect;
};

export type IExternalSignMessagePayload = {
  account: IDBExternalAccount;
  networkId: string;
  params: ISignMessageParams;
  connector: IExternalConnector;
};

export abstract class ExternalControllerBase {
  constructor({
    factory,
    backgroundApi,
  }: {
    factory: ExternalWalletFactory;

    backgroundApi: IBackgroundApi;
  }) {
    this.backgroundApi = backgroundApi;
    this.factory = factory;
  }

  backgroundApi: IBackgroundApi;

  factory: ExternalWalletFactory;

  async getWcChain({ networkId }: { networkId: string }): Promise<string> {
    return this.backgroundApi.serviceWalletConnect.getWcChainByNetworkId({
      networkId,
    });
  }

  abstract listWallets(): Promise<IExternalListWalletsResult>;

  abstract createConnector({
    connectionInfo,
  }: {
    connectionInfo: IExternalConnectionInfo;
  }): Promise<IExternalCreateConnectorResult>;

  abstract connectWallet({
    connector,
  }: {
    connector: IExternalConnector;
  }): Promise<IExternalConnectWalletResult>;

  abstract addEventListeners({
    connector,
    accountId,
  }: {
    connector: IExternalConnector;
    accountId: string | undefined;
  }): void;

  abstract removeEventListeners({
    connector,
    accountId,
  }: {
    connector: IExternalConnector;
    accountId: string | undefined;
  }): void;

  abstract handleWalletConnectEvents(
    params: IExternalHandleWalletConnectEventsParams,
  ): Promise<void>;

  abstract sendTransactionByWalletConnect(
    payload: IExternalSendTransactionByWalletConnectPayload,
  ): Promise<ISignedTxPro>;

  abstract signMessageByWalletConnect(
    payload: IExternalSignMessageByWalletConnectPayload,
  ): Promise<ISignedMessagePro>;

  abstract sendTransaction(
    payload: IExternalSendTransactionPayload,
  ): Promise<ISignedTxPro>;

  abstract signMessage(
    payload: IExternalSignMessagePayload,
  ): Promise<ISignedMessagePro>;
}
