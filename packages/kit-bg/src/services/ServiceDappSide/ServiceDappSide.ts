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
    // only web can list injected wallets by browser extension
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

  async disconnectExternalWallet({
    account,
    accountId,
  }: {
    account: IDBAccount | undefined;
    accountId?: string | undefined;
  }) {
    // eslint-disable-next-line no-param-reassign
    account =
      account ||
      (await this.backgroundApi.serviceAccount.getDBAccount({
        accountId: accountId || '',
      }));
    const externalAccount = account as IDBExternalAccount;

    const connectionInfo = externalAccount.connectionInfo;

    if (connectionInfo) {
      let shouldDestroyConnector = true;
      if (connectionInfo.walletConnect) {
        const topic = connectionInfo.walletConnect.topic;
        const { accounts } =
          await this.backgroundApi.serviceAccount.getWalletConnectDBAccounts({
            topic,
          });
        // only destroy connector when no other accounts using the same topic
        if (accounts?.length > 0) {
          shouldDestroyConnector = false;
        }
      }
      if (shouldDestroyConnector) {
        await this.destroyConnector({ connectionInfo });
      }
    }
  }

  connectorCache: {
    [cachedKey: string]: {
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

  buildConnectorCacheKey({
    connectionInfo,
  }: {
    connectionInfo: IExternalConnectionInfo;
  }) {
    let cachedKey = '';
    let accountId: string | undefined;
    if (connectionInfo.walletConnect?.topic) {
      cachedKey = `walletconnect@${connectionInfo.walletConnect.topic}`;
    } else {
      accountId = accountUtils.buildExternalAccountId({
        wcSessionTopic: undefined,
        connectionInfo,
      });
      cachedKey = accountId;
    }
    return {
      cachedKey,
      accountId,
    };
  }

  async getConnectorCached({
    connectionInfo,
    newConnection,
  }: {
    connectionInfo: IExternalConnectionInfo;
    newConnection?: boolean;
  }) {
    let accountId: string | undefined = '';
    let cachedKey = '';

    if (newConnection && connectionInfo.walletConnect?.isNewConnection) {
      accountId = '';
      cachedKey = '';
    } else {
      ({ accountId, cachedKey } = this.buildConnectorCacheKey({
        connectionInfo,
      }));
    }

    let currentConnector: IExternalConnector | undefined =
      this.connectorCache[cachedKey]?.connector;

    if (currentConnector && newConnection) {
      // disconnect first to off events if create new connection
      await currentConnector.disconnect();
      await this.destroyConnector({ connectionInfo });
      currentConnector = undefined;
    }

    if (!currentConnector) {
      currentConnector = await this.initConnector({
        connectionInfo,
        accountId,
        cachedKey,
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
    cachedKey,
    newConnection,
  }: {
    connectionInfo: IExternalConnectionInfo;
    accountId: string | undefined;
    cachedKey: string;
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
    if (cachedKey) {
      this.connectorCache[cachedKey] = { connector };
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
    const { cachedKey } = this.buildConnectorCacheKey({
      connectionInfo,
    });
    this.connectorCache[cachedKey] = { connector };
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
    const { accountId, cachedKey } = this.buildConnectorCacheKey({
      connectionInfo,
    });
    ctrl.removeEventListeners({ connector, accountId });
    await connector.disconnect();
    delete this.connectorCache[cachedKey];
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
      // newConnection // TODO open newConnection if wallet is disconnected
    });
    // TODO check address or network matched
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
    // TODO check address or network matched
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
