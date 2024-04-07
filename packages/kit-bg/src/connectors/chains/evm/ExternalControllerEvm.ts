import { injected } from '@wagmi/core';
import { isNil, uniqBy } from 'lodash';

import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type {
  IExternalConnectResultEvm,
  IExternalConnectWalletResult,
  IExternalConnectionInfo,
  IExternalConnector,
  IExternalConnectorEvm,
  IExternalCreateConnectorResult,
  IExternalListWalletsResult,
  IExternalWalletInfo,
  IWagmiConnectorEventMap,
} from '@onekeyhq/shared/types/externalWallet.types';

import localDb from '../../../dbs/local/localDb';
import { ExternalControllerBase } from '../../base/ExternalControllerBase';

import evmConnectorUtils from './evmConnectorUtils';
import { ExternalManagerEvm } from './ExternalManagerEvm';

import type {
  IDBAccountAddressesMap,
  IDBExternalAccount,
} from '../../../dbs/local/types';
import type {
  ISignMessageParams,
  ISignTransactionParams,
} from '../../../vaults/types';

export class ExternalControllerEvm extends ExternalControllerBase {
  listeners: Record<string, (data: any) => Promise<void>> = {};

  override removeEventListeners({
    connector,
    accountId,
  }: {
    connector: IExternalConnectorEvm;
    accountId: string;
  }): void {
    connector.emitter.off('change', this.listeners[accountId]);
    delete this.listeners[accountId];
  }

  override addEventListeners({
    connector,
    accountId,
  }: {
    connector: IExternalConnectorEvm;
    accountId: string;
  }): void {
    this.removeEventListeners({ connector, accountId });

    this.listeners[accountId] = async (data: {
      accounts?: readonly `0x${string}`[] | undefined;
      chainId?: number | undefined;
      uid: string;
    }) => {
      console.log('ExternalWalletControllerEvm change event');
      const chainId = await connector.getChainId();
      await this.updateExternalAccountSelectedAddressEvm({
        accountId,
        chainId,
        wagmiConnectorChangeEventParams: data,
      });
    };
    connector.emitter.on('change', this.listeners[accountId]);
  }

  async updateExternalAccountSelectedAddressEvm({
    accountId,
    chainId,
    wagmiConnectorChangeEventParams,
  }: {
    accountId: string;
    chainId: number;
    wagmiConnectorChangeEventParams: IWagmiConnectorEventMap['change'];
  }) {
    const { accounts } = wagmiConnectorChangeEventParams;
    const usedChainId = wagmiConnectorChangeEventParams.chainId ?? chainId;
    if (accounts && accounts.length && !isNil(usedChainId)) {
      const { addressMap, createAtNetwork } =
        await this.buildEvmConnectedAddressMap({
          chainId: usedChainId,
          accounts: accounts as any,
        });
      await localDb.updateExternalAccount({
        accountId,
        addressMap,
        createAtNetwork,
      });
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    }
  }

  _manager: ExternalManagerEvm | undefined;

  get manager() {
    if (!this._manager) {
      this._manager = new ExternalManagerEvm();
    }
    return this._manager;
  }

  override async listWallets(): Promise<IExternalListWalletsResult> {
    const uuidOneKeyInjectAsMetamask = '7677b54f-3486-46e2-4e37-bf8747814f';
    // const uuidOneKeyInjectAsMetamask = '';
    const allProvidersDetail = this.manager
      .getProviders()
      .filter((item) => item.info.uuid !== uuidOneKeyInjectAsMetamask);

    // EVM injected wallet icon
    const icon =
      'https://explorer-api.walletconnect.com/v3/logo/lg/5195e9db-94d8-4579-6f11-ef553be95100?projectId=2f05ae7f1116030fde2d36508f472bfb';
    const evmInjectedWallet: IExternalWalletInfo = {
      name: 'Injected',
      icon,
      connectionInfo: {
        evmInjected: {
          global: 'ethereum',
          icon,
        },
      },
    };

    // return allProvidersDetail;
    const eip6963Wallets: IExternalWalletInfo[] = uniqBy(
      allProvidersDetail,
      (item) => item.info.rdns,
    ).map((item) => ({
      name: item.info.name,
      icon: item.info.icon,
      connectionInfo: {
        evmEIP6963: {
          info: item.info,
        },
      },
    }));

    return {
      wallets: [evmInjectedWallet, ...eip6963Wallets],
    };
  }

  override async createConnector({
    connectionInfo,
  }: {
    connectionInfo: IExternalConnectionInfo;
  }): Promise<IExternalCreateConnectorResult> {
    const { evmEIP6963, evmInjected } = connectionInfo;
    let connectorFn;
    if (evmEIP6963?.info) {
      connectorFn = this.manager.providerDetailToConnector({
        info: evmEIP6963?.info,
      });
    }
    if (evmInjected) {
      connectorFn = injected();
    }
    if (!connectorFn) {
      throw new Error('connectorFn is not defined');
    }
    const connector = await this.manager.setup(connectorFn, connectionInfo);
    // TODO cache connector and destroy
    // add events
    return { connector, connectionInfo };
  }

  private async buildEvmConnectedAddressMap({
    chainId,
    accounts,
  }: {
    chainId: number;
    accounts: readonly `0x${string}`[];
  }) {
    const notSupportedNetworkIds: string[] = [];
    let networkId = `${IMPL_EVM}--${chainId}`;
    const network = await this.backgroundApi.serviceNetwork.getNetworkSafe({
      networkId,
    });
    if (!network) {
      notSupportedNetworkIds.push(networkId);
    }
    // check peer wallet networkId is included in supported networks, otherwise fallback to ETH mainnet
    networkId = network ? networkId : getNetworkIdsMap().eth;
    const addresses = accounts.join(',');
    const addressMap: IDBAccountAddressesMap = {
      // evm can use impl for all sub networks
      [networkId]: addresses,
      [IMPL_EVM]: addresses,
    };
    const impl = IMPL_EVM;
    const createAtNetwork = networkId;
    // networkIds = [networkId]; // limit account can only use these networks
    return {
      impl,
      createAtNetwork,
      addressMap,
      networkId,
      notSupportedNetworkIds,
    };
  }

  override async connectWallet({
    connector,
  }: {
    connector: IExternalConnector;
  }): Promise<IExternalConnectWalletResult> {
    const { connectionInfo } = connector;
    checkIsDefined(connectionInfo);
    // const { connector } = await this.createConnector({ connectionInfo });
    const result = (await connector.connect()) as IExternalConnectResultEvm;
    const { impl, createAtNetwork, addressMap, notSupportedNetworkIds } =
      await this.buildEvmConnectedAddressMap(result);
    return {
      connectionInfo,
      accountInfo: {
        impl,
        createAtNetwork,
        addresses: addressMap,
        networkIds: undefined,
      },
      notSupportedNetworkIds,
    };
  }

  override async sendTransaction({
    connector,
    params,
  }: {
    account: IDBExternalAccount;
    networkId: string;
    connector: IExternalConnectorEvm;
    params: ISignTransactionParams;
  }): Promise<ISignedTxPro> {
    const { method, callParams } = evmConnectorUtils.parseSendTransactionParams(
      {
        params,
      },
    );
    const provider = await connector.getProvider();
    const txid = await provider.request({
      method,
      params: callParams as any,
    });

    if (!txid) {
      throw new Error(
        'ExternalWalletControllerEvm sendTransaction ERROR: txid not found',
      );
    }

    return {
      txid,
      rawTx: '',
      encodedTx: params.unsignedTx.encodedTx,
    };
  }

  override async signMessage({
    params,
    connector,
  }: {
    account: IDBExternalAccount;
    networkId: string;
    params: ISignMessageParams;
    connector: IExternalConnectorEvm;
  }): Promise<ISignedMessagePro> {
    const { method, callParams } = evmConnectorUtils.parseSignMessageParams({
      params,
    });
    const provider = await connector.getProvider();
    const result = await provider.request({
      method,
      params: callParams,
    });

    return [result];
  }
}
