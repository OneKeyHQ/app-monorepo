import { isNil, isString, uniqBy } from 'lodash';

import type { ISignedMessagePro, ISignedTxPro } from '@onekeyhq/core/src/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  IExternalConnectResultEvm,
  IExternalConnectWalletResult,
  IExternalConnectionInfo,
  IExternalConnectorEvm,
  IExternalCreateConnectorResult,
  IExternalListWalletsResult,
  IExternalWalletInfo,
  IWagmiConnectorEventMap,
} from '@onekeyhq/shared/types/externalWallet.types';

import localDb from '../../../dbs/local/localDb';
import { ExternalControllerBase } from '../../base/ExternalControllerBase';

import { EvmConnectorManager } from './EvmConnectorManager';
import evmConnectorUtils from './evmConnectorUtils';
import { ExternalConnectorEvmEIP6963 } from './ExternalConnectorEvmEIP6963';
import { ExternalConnectorEvmInjected } from './ExternalConnectorEvmInjected';

import type { IDBAccountAddressesMap } from '../../../dbs/local/types';
import type {
  IExternalHandleWalletConnectEventsParams,
  IExternalSendTransactionByWalletConnectPayload,
  IExternalSendTransactionPayload,
  IExternalSignMessageByWalletConnectPayload,
  IExternalSignMessagePayload,
} from '../../base/ExternalControllerBase';

export class ExternalControllerEvm extends ExternalControllerBase {
  changeListeners: Record<string, (data: any) => Promise<void>> = {};

  disconnectListeners: Record<string, (data: any) => Promise<void>> = {};

  override removeEventListeners({
    connector,
    accountId,
  }: {
    connector: IExternalConnectorEvm;
    accountId: string | undefined;
  }): void {
    if (accountId) {
      connector.emitter.off('change', this.changeListeners[accountId]);
      connector.emitter.off('disconnect', this.disconnectListeners[accountId]);
      delete this.changeListeners[accountId];
      delete this.disconnectListeners[accountId];
    }
  }

  override addEventListeners({
    connector,
    accountId,
  }: {
    connector: IExternalConnectorEvm;
    accountId: string | undefined;
  }): void {
    this.removeEventListeners({ connector, accountId });

    if (accountId) {
      this.changeListeners[accountId] = async (data: {
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
      // TODO move disconnectListeners handler to base class
      this.disconnectListeners[accountId] = async (data: any) => {
        console.log('wallet disconnect', data, accountId);
        await this.backgroundApi.serviceDappSide.disconnectExternalWallet({
          accountId,
          account: undefined,
        });
      };
      connector.emitter.on('change', this.changeListeners[accountId]);
      connector.emitter.once('disconnect', this.disconnectListeners[accountId]);
    }
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
    } else if (!isNil(usedChainId)) {
      await this.updateAccountCreateAtNetwork({
        chainId: usedChainId,
        accountId,
      });
    }
  }

  _manager: EvmConnectorManager | undefined;

  get manager() {
    if (!this._manager) {
      this._manager = new EvmConnectorManager();
    }
    return this._manager;
  }

  override async listWallets(): Promise<IExternalListWalletsResult> {
    const uuidOneKeyInjectAsMetamask = '7677b54f-3486-46e2-4e37-bf8747814f';
    // const uuidOneKeyInjectAsMetamask = '';
    const allProvidersDetail = this.manager
      .getProviders()
      .filter((item) => item.info.uuid !== uuidOneKeyInjectAsMetamask);

    const icon = externalWalletLogoUtils.getLogoInfo('injected').logo;
    const evmInjectedWallet: IExternalWalletInfo = {
      name: 'Injected',
      icon,
      connectionInfo: {
        evmInjected: {
          global: 'ethereum',
          icon,
          name: 'Injected',
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
    let connector: IExternalConnectorEvm | undefined;
    if (evmEIP6963?.info) {
      connector = await ExternalConnectorEvmEIP6963.createConnector({
        manager: this.manager,
        connectionInfo,
      });
    }
    if (evmInjected) {
      connector = await ExternalConnectorEvmInjected.createConnector({
        manager: this.manager,
        connectionInfo,
      });
    }
    if (!connector) {
      throw new Error('connector is not defined');
    }
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
    connector: IExternalConnectorEvm;
  }): Promise<IExternalConnectWalletResult> {
    const { connectionInfo } = connector;
    checkIsDefined(connectionInfo);
    // const { connector } = await this.createConnector({ connectionInfo });
    const result = (await connector.connect()) as IExternalConnectResultEvm;
    const { impl, createAtNetwork, addressMap, notSupportedNetworkIds } =
      await this.buildEvmConnectedAddressMap(result);
    let name = '';
    if (connectionInfo?.evmInjected?.name) {
      name = connectionInfo?.evmInjected?.name;
    }
    if (connectionInfo?.evmEIP6963?.info?.name) {
      name = connectionInfo?.evmEIP6963?.info?.name;
    }
    return {
      connectionInfo,
      accountInfo: {
        impl,
        createAtNetwork,
        addresses: addressMap,
        networkIds: undefined,
        name: name || '',
      },
      notSupportedNetworkIds,
    };
  }

  override async signMessageByWalletConnect(
    payload: IExternalSignMessageByWalletConnectPayload,
  ): Promise<ISignedMessagePro> {
    const { params, networkId, connector } = payload;

    const wcChain = await this.getWcChain({ networkId });
    const { method, callParams } = evmConnectorUtils.parseSignMessageParams({
      params,
    });
    const provider = await connector.getProvider();
    const result = (await provider.request(
      {
        method,
        params: callParams,
      },
      wcChain,
    )) as string;

    return [result];
  }

  override async sendTransactionByWalletConnect(
    payload: IExternalSendTransactionByWalletConnectPayload,
  ): Promise<ISignedTxPro> {
    const { params, networkId, connector } = payload;

    const wcChain = await this.getWcChain({ networkId });
    const { method, callParams } = evmConnectorUtils.parseSendTransactionParams(
      {
        params,
      },
    );
    const provider = await connector.getProvider();
    const txid = (await provider.request(
      {
        method,
        params: callParams,
      },
      wcChain,
    )) as string;

    if (!txid) {
      throw new Error(
        'ExternalWalletControllerWalletConnect sendTransaction ERROR: txid not found',
      );
    }

    return {
      txid,
      rawTx: '',
      encodedTx: params.unsignedTx.encodedTx,
    };
  }

  override async handleWalletConnectEvents(
    params: IExternalHandleWalletConnectEventsParams,
  ): Promise<void> {
    const { eventData, eventName, account, wcChainInfo } = params;

    // handle accountsChanged
    if (eventName === 'accountsChanged') {
      // const wcSessionEvent = {
      //   'id': 1710226817544891,
      //   'topic':
      //     '7452725652a616ebc2554ee049b026d56f537177c969fe5c07f92f75ee5e8bb6',
      //   'params': {
      //     'event': {
      //       'name': 'accountsChanged',
      //       'data': ['eip155:137:0x111'],
      //     },
      //     'chainId': 'eip155:137',
      //   },
      // };

      if (wcChainInfo && account) {
        const { isMergedNetwork, networkIdOrImpl } =
          accountUtils.getWalletConnectMergedNetwork({
            networkId: wcChainInfo.networkId,
          });
        const impl = networkUtils.getNetworkImpl({
          networkId: wcChainInfo.networkId,
        });
        const addresses =
          account.connectedAddresses[networkIdOrImpl]
            .split(',')
            .filter(Boolean) || [];
        const eventAddress = (eventData as string[] | undefined)?.[0];
        if (eventAddress && isString(eventAddress)) {
          const result =
            this.backgroundApi.serviceWalletConnect.parseWalletConnectFullAddress(
              {
                wcAddress: eventAddress,
              },
            );
          const addressIndex = addresses.indexOf(result.address);
          if (addressIndex >= 0) {
            const selectedMapNew = {
              ...account.selectedAddress,
              [networkIdOrImpl]: addressIndex,
            };
            if (isMergedNetwork) {
              // walletconnect always use impl to find compatible network if isMergedNetwork=true
              delete selectedMapNew[wcChainInfo.networkId];
            } else {
              delete selectedMapNew[impl];
            }
            await localDb.updateExternalAccount({
              accountId: account.id,
              selectedMap: selectedMapNew,
            });
            appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
          }
        }
      }
    }

    // handle chainChanged
    if (eventName === 'chainChanged') {
      // const wcSessionEvent = {
      //   'id': 1710226674065096,
      //   'topic':
      //     '7452725652a616ebc2554ee049b026d56f537177c969fe5c07f92f75ee5e8bb6',
      //   'params': {
      //     'event': { 'name': 'chainChanged', 'data': 137 },
      //     'chainId': 'eip155:137',
      //   },
      // };
      await this.updateAccountCreateAtNetwork({
        chainId: eventData as number,
        accountId: account.id,
      });
    }
  }

  async updateAccountCreateAtNetwork({
    accountId,
    chainId,
  }: {
    accountId: string | undefined;
    chainId: string | number;
  }) {
    const newNetworkId = `evm--${chainId}`;
    const network = await this.backgroundApi.serviceNetwork.getNetworkSafe({
      networkId: newNetworkId,
    });
    if (network && accountId) {
      await localDb.updateExternalAccount({
        accountId,
        createAtNetwork: network.id,
      });
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    }
  }

  override async sendTransaction(
    payload: IExternalSendTransactionPayload,
  ): Promise<ISignedTxPro> {
    const { params } = payload;
    const connector = payload.connector as IExternalConnectorEvm;
    const { method, callParams } = evmConnectorUtils.parseSendTransactionParams(
      {
        params,
      },
    );
    // TODO check isAuthorized, check address matched, check network matched and request chain switch
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

  override async signMessage(
    payload: IExternalSignMessagePayload,
  ): Promise<ISignedMessagePro> {
    const { params } = payload;
    const connector = payload.connector as IExternalConnectorEvm;
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
