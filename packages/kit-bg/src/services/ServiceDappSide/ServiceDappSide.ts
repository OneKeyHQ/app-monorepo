import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ServiceBase from '../ServiceBase';

import { EvmEIP6963Provider } from './providers/evm/EvmEIP6963Provider';

import type {
  IEIP6963ProviderDetail,
  IExternalConnectResult,
} from './providers/evm/EvmEIP6963Provider';
import type {
  IDBAccount,
  IDBExternalAccount,
  IDBExternalConnectionInfo,
} from '../../dbs/local/types';

// TODO rename to ServiceExternalWallet
@backgroundClass()
class ServiceDappSide extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _evmEIP6963Provider: EvmEIP6963Provider | undefined;

  get evmEIP6963Provider() {
    if (!this._evmEIP6963Provider) {
      this._evmEIP6963Provider = new EvmEIP6963Provider();
    }
    return this._evmEIP6963Provider;
  }

  @backgroundMethod()
  async listAllEvmWallets(): Promise<{ wallets: IEIP6963ProviderDetail[] }> {
    if (!platformEnv.isWeb) {
      return {
        wallets: [],
      };
    }
    const results = this.evmEIP6963Provider.listAllWallets();
    const wallets = results.map((result) => ({ info: result.info }));
    // TODO return all wallets including injected and walletconnect, by chain grouped
    return {
      wallets,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async connectExternalWallet({
    connection,
  }: {
    connection: IDBExternalConnectionInfo;
  }): Promise<IExternalConnectResult> {
    const { evmEIP6963, evmInjected, walletConnect } = connection;
    if (evmEIP6963 || evmInjected) {
      // TODO call this.getExternalConnectorEvm()
      const connector = await this.evmEIP6963Provider.createEvmConnector({
        evmEIP6963,
        evmInjected,
      });
      const result: IExternalConnectResult = await connector.connect();
      result.evmEIP6963 = evmEIP6963;
      result.evmInjected = evmInjected;
      result.evmResult = {
        accounts: result.accounts,
        chainId: result.chainId,
      };
      return result;
    }
    if (walletConnect) {
      const wcSession =
        await this.backgroundApi.serviceWalletConnect.connectToWallet();
      if (!wcSession) {
        throw new Error(
          'connectExternalWallet by WalletConnect ERROR: wcSession not found',
        );
      }
      return {
        accounts: [],
        chainId: 1,
        wcSession,
      };
    }
    throw new Error('connectExternalWallet ERROR: connection not found');
  }

  async disconnectExternalWallet({ account }: { account: IDBAccount }) {
    const externalAccount = account as IDBExternalAccount;

    if (
      externalAccount.externalInfo?.evmEIP6963 ||
      externalAccount.externalInfo?.evmInjected
    ) {
      const { connector } = await this.getExternalConnectorEvm({
        accountId: account.id,
      });
      await connector.disconnect();
    }

    // disconnect walletconnect session
    const topic = externalAccount.wcTopic;
    if (topic) {
      await this.backgroundApi.serviceWalletConnect.dappSide.disconnectProvider(
        {
          topic,
        },
      );
    }
  }

  // TODO cache, getOrCreateConnector(externalInfo)
  async getExternalConnectorEvm({ accountId }: { accountId: string }) {
    const account = await this.backgroundApi.serviceAccount.getDBAccount({
      accountId,
    });
    const externalAccount = account as IDBExternalAccount;
    const evmEIP6963 = externalAccount.externalInfo?.evmEIP6963;
    const evmInjected = externalAccount.externalInfo?.evmInjected;

    const connector =
      await this.backgroundApi.serviceDappSide.evmEIP6963Provider.createEvmConnector(
        {
          evmInjected,
          evmEIP6963,
        },
      );
    connector.emitter.on('change', async (data) => {
      console.log(
        'EvmConnector change event',
        data.accounts,
        evmEIP6963,
        evmInjected,
      );
      const chainId = await connector.getChainId();
      await this.backgroundApi.serviceAccount.updateExternalAccountSelectedAddressEvm(
        {
          accountId,
          chainId,
          wagmiConnectorChangeEventParams: data,
        },
      );
    });
    await connector.connect({ isReconnecting: true }); // should call connect() with isReconnecting=true to make event emitter working
    const provider = await connector.getProvider();

    // TODO return walletConnectConnector
    return {
      provider,
      connector,
    };
  }
}

export default ServiceDappSide;
