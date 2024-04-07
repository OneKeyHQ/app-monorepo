import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
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

export abstract class ExternalControllerBase {
  constructor({ backgroundApi }: { backgroundApi: IBackgroundApi }) {
    this.backgroundApi = backgroundApi;
  }

  backgroundApi: IBackgroundApi;

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
    accountId: string;
  }): void;

  abstract removeEventListeners({
    connector,
    accountId,
  }: {
    connector: IExternalConnector;
    accountId: string;
  }): void;

  abstract sendTransaction({
    account,
    networkId,
    params,
    connector,
  }: {
    account: IDBExternalAccount;
    networkId: string;
    params: ISignTransactionParams;
    connector: IExternalConnector;
  }): Promise<ISignedTxPro>;

  abstract signMessage({
    account,
    networkId,
    params,
    connector,
  }: {
    account: IDBExternalAccount;
    networkId: string;
    params: ISignMessageParams;
    connector: IExternalConnector;
  }): Promise<ISignedMessagePro>;
}
