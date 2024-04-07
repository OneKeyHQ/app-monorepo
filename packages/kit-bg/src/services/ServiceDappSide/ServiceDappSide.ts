import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IExternalConnectWalletResult,
  IExternalConnectionInfo,
  IExternalConnector,
  IExternalWalletInfo,
} from '@onekeyhq/shared/types/externalWallet.types';

import externalWalletFactory from '../../connectors/externalWalletFactory';
import ServiceBase from '../ServiceBase';

import type { IDBAccount, IDBExternalAccount } from '../../dbs/local/types';
import type {
  ISignMessageParams,
  ISignTransactionParams,
} from '../../vaults/types';

// TODO rename to ServiceExternalWallet
type IListAllExternalWalletsResult = {
  wallets: {
    [impl: string]: IExternalWalletInfo[];
  };
};
@backgroundClass()
class ServiceDappSide extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async listAllWallets({
    impls,
  }: {
    impls: string[];
  }): Promise<IListAllExternalWalletsResult> {
    const result: IListAllExternalWalletsResult = {
      wallets: {},
    };
    if (!platformEnv.isWeb) {
      return result;
    }
    for (const impl of impls) {
      const ctrl = await externalWalletFactory.getController({ impl });
      const { wallets } = await ctrl.listWallets();
      result.wallets[impl] = wallets;
    }
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async connectExternalWallet({
    connectionInfo,
  }: {
    connectionInfo: IExternalConnectionInfo;
  }): Promise<IExternalConnectWalletResult> {
    const ctrl = await externalWalletFactory.getController({
      connectionInfo,
    });
    const { connector } = await this.getConnectorCached({
      connectionInfo,
      newConnection: true,
    });
    const connectResult = await ctrl.connectWallet({
      connector,
    });
    // reassign connectionInfo from connectResult to connector
    connector.connectionInfo =
      connectResult.connectionInfo || connector.connectionInfo;

    this.saveConnectorCache({
      connectionInfo: connectResult.connectionInfo,
      connector,
    });
    return connectResult;
  }

  async disconnectExternalWallet({ account }: { account: IDBAccount }) {
    const externalAccount = account as IDBExternalAccount;

    const connectionInfo = externalAccount.connectionInfo;

    if (connectionInfo) {
      await this.destroyConnector({ connectionInfo });
    }
  }

  connectorCache: {
    [accountId: string]: {
      connector: IExternalConnector;
    };
  } = {};

  @backgroundMethod()
  async activateConnector({
    connectionInfo,
  }: {
    connectionInfo: IExternalConnectionInfo;
  }) {
    await this.getConnectorCached({ connectionInfo });
  }

  async getConnectorCached({
    connectionInfo,
    newConnection,
  }: {
    connectionInfo: IExternalConnectionInfo;
    newConnection?: boolean;
  }) {
    let accountId = '';

    if (newConnection && connectionInfo.walletConnect === (true as any)) {
      accountId = '';
    } else {
      accountId = accountUtils.buildExternalAccountId({
        wcSessionTopic: undefined,
        connectionInfo,
      });
    }

    let currentConnector: IExternalConnector | undefined =
      this.connectorCache[accountId]?.connector;

    if (currentConnector && newConnection) {
      // disconnect first to off events
      await currentConnector.disconnect();
      await this.destroyConnector({ connectionInfo });
      currentConnector = undefined;
    }

    if (!currentConnector) {
      currentConnector = await this.initConnector({
        connectionInfo,
        accountId,
        newConnection,
      });
    }

    return {
      connector: currentConnector,
    };
  }

  async initConnector({
    connectionInfo,
    accountId,
    newConnection,
  }: {
    connectionInfo: IExternalConnectionInfo;
    accountId: string;
    newConnection?: boolean;
  }) {
    const ctrl = await externalWalletFactory.getController({
      connectionInfo,
    });
    const { connector } = await ctrl.createConnector({
      connectionInfo,
    });
    ctrl.addEventListeners({ connector, accountId });
    if (!newConnection) {
      await connector.connect({ isReconnecting: true }); // should call connect() with isReconnecting=true to make event emitter working
    }
    if (accountId) {
      this.connectorCache[accountId] = { connector };
    }
    return connector;
  }

  saveConnectorCache({
    connectionInfo,
    connector,
  }: {
    connectionInfo: IExternalConnectionInfo;
    connector: IExternalConnector;
  }) {
    const accountId = accountUtils.buildExternalAccountId({
      connectionInfo,
      wcSessionTopic: undefined,
    });
    this.connectorCache[accountId] = { connector };
  }

  async destroyConnector({
    connectionInfo,
  }: {
    connectionInfo: IExternalConnectionInfo;
  }) {
    const ctrl = await externalWalletFactory.getController({
      connectionInfo,
    });
    const { connector } = await this.getConnectorCached({
      connectionInfo,
    });
    const accountId = accountUtils.buildExternalAccountId({
      connectionInfo,
      wcSessionTopic: undefined,
    });
    ctrl.removeEventListeners({ connector, accountId });
    await connector.disconnect();
    delete this.connectorCache[accountId];
  }

  async sendTransaction({
    account,
    networkId,
    params,
  }: {
    account: IDBExternalAccount;
    networkId: string;
    params: ISignTransactionParams;
  }): Promise<ISignedTxPro> {
    const connectionInfo = account.connectionInfo;
    if (!connectionInfo) {
      throw new Error('sendTransaction ERROR: connectionInfo not found');
    }
    const ctrl = await externalWalletFactory.getController({
      connectionInfo,
    });
    const { connector } = await this.getConnectorCached({
      connectionInfo,
    });
    const result = await ctrl.sendTransaction({
      account,
      networkId,
      params,
      connector,
    });
    return result;
  }

  async signMessage({
    account,
    networkId,
    params,
  }: {
    networkId: string;
    account: IDBExternalAccount;
    params: ISignMessageParams;
  }): Promise<ISignedMessagePro> {
    const connectionInfo = account.connectionInfo;
    if (!connectionInfo) {
      throw new Error('signMessage ERROR: connectionInfo not found');
    }
    const ctrl = await externalWalletFactory.getController({
      connectionInfo,
    });
    const { connector } = await this.getConnectorCached({
      connectionInfo,
    });
    const result = await ctrl.signMessage({
      account,
      networkId,
      params,
      connector,
    });
    return result;
  }
}

export default ServiceDappSide;
