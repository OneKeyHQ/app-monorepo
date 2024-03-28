import { injected } from '@wagmi/core';
import { uniqBy } from 'lodash';
import { createStore as createMipd } from 'mipd';
import { type EIP1193Provider } from 'viem';

import type {
  IDBExternalConnectionInfoEvmEIP6963,
  IDBExternalConnectionInfoEvmInjected,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import type { IWalletConnectSession } from '@onekeyhq/shared/src/walletConnect/types';

import { createEmitter } from '../../utils/WagmiEventEmitter';
import { uid } from '../../utils/wagmiUid';

import type { Emitter, EventData } from '../../utils/WagmiEventEmitter';
import type { ConnectorEventMap, CreateConnectorFn } from '@wagmi/core';
import type { EIP6963ProviderInfo, Rdns, Store } from 'mipd';

export type IEvaluate<type> = { [key in keyof type]: type[key] } & unknown;

type IWalletProviderFlags =
  | 'isApexWallet'
  | 'isAvalanche'
  | 'isBackpack'
  | 'isBifrost'
  | 'isBitKeep'
  | 'isBitski'
  | 'isBlockWallet'
  | 'isBraveWallet'
  | 'isCoinbaseWallet'
  | 'isDawn'
  | 'isEnkrypt'
  | 'isExodus'
  | 'isFrame'
  | 'isFrontier'
  | 'isGamestop'
  | 'isHyperPay'
  | 'isImToken'
  | 'isKuCoinWallet'
  | 'isMathWallet'
  | 'isMetaMask'
  | 'isOkxWallet'
  | 'isOKExWallet'
  | 'isOneInchAndroidWallet'
  | 'isOneInchIOSWallet'
  | 'isOpera'
  | 'isPhantom'
  | 'isPortal'
  | 'isRabby'
  | 'isRainbow'
  | 'isStatus'
  | 'isTally'
  | 'isTokenPocket'
  | 'isTokenary'
  | 'isTrust'
  | 'isTrustWallet'
  | 'isXDEFI'
  | 'isZerion';

export type IEvmWalletProvider = IEvaluate<
  EIP1193Provider & {
    [key in IWalletProviderFlags]?: true | undefined;
  } & {
    providers?: IEvmWalletProvider[] | undefined;
    /** Only exists in MetaMask as of 2022/04/03 */
    _events?: { connect?: (() => void) | undefined } | undefined;
    /** Only exists in MetaMask as of 2022/04/03 */
    _state?:
      | {
          accounts?: string[];
          initialized?: boolean;
          isConnected?: boolean;
          isPermanentlyDisconnected?: boolean;
          isUnlocked?: boolean;
        }
      | undefined;
  }
>;

export type IWagmiConnector<TProvider> = ReturnType<
  CreateConnectorFn<TProvider>
> & {
  emitter: Emitter<ConnectorEventMap>;
  uid: string;
};
export type IWagmiConnectorEvm = IWagmiConnector<IEvmWalletProvider>;

export type IEIP6963ProviderInfo = EIP6963ProviderInfo<Rdns>;
export type IEIP6963ProviderDetail = {
  info: IEIP6963ProviderInfo;
};
export type IExternalConnectResultEvm = {
  accounts: readonly `0x${string}`[];
  chainId: number;
};
export type IExternalConnectResult = {
  accounts: readonly `0x${string}`[]; // TODO remove
  chainId: number; // TODO remove

  // TODO use connection: IDBExternalConnectionInfo
  evmEIP6963?: IDBExternalConnectionInfoEvmEIP6963;
  evmInjected?: IDBExternalConnectionInfoEvmInjected;
  evmResult?: IExternalConnectResultEvm;

  wcSession?: IWalletConnectSession;

  // createAtNetwork, impl, addressMap, networkIds
};

export type IWagmiConnectorEventMap = ConnectorEventMap;

// TODO rename to EvmEIP6963Connector
export class EvmEIP6963Provider {
  _mipd: Store | undefined;

  private get mipdStore() {
    const multiInjectedProviderDiscovery = true;
    if (!this._mipd) {
      this._mipd =
        typeof window !== 'undefined' && multiInjectedProviderDiscovery
          ? createMipd()
          : undefined;
    }
    checkIsDefined(this._mipd);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this._mipd!;
  }

  private providerDetailToConnector(providerDetail: IEIP6963ProviderDetail) {
    // save info to dbAccount
    const { info } = providerDetail;

    // find provider by info.rdns which is saved in dbAccount
    // TODO mipd auto discovery by subscribe
    let providerDetailFound = this.mipdStore?.findProvider({
      rdns: info.rdns,
    });
    // uuid not matched, should find provider by uuid & rdns
    if (providerDetailFound?.info.uuid !== info.uuid) {
      const allProvidersDetail = this.mipdStore.getProviders();
      let detail = allProvidersDetail.find(
        (item) => item.info.uuid === info.uuid && item.info.rdns === info.rdns,
      );
      if (!detail) {
        const uuidOneKeyInjectAsMetamask = '7677b54f-3486-46e2-4e37-bf8747814f';
        detail = allProvidersDetail.find(
          (item) =>
            item.info.uuid !== uuidOneKeyInjectAsMetamask &&
            item.info.rdns === info.rdns,
        );
      }
      providerDetailFound = detail || providerDetailFound;
    }

    const provider = providerDetailFound?.provider;
    // const provider2 = providerDetail.provider as any;

    if (!provider) {
      throw new Error(`EVM EIP6963 provider not found: ${info.rdns}`);
    }
    const connectorFn = injected({
      target: {
        ...info,
        id: info.rdns,
        provider,
      },
    });
    return connectorFn;
  }

  // https://github.com/wevm/wagmi/blob/main/packages/core/src/createConfig.ts#L97
  private async setup(
    connectorFn: CreateConnectorFn,
  ): Promise<IWagmiConnectorEvm> {
    // Set up emitter with uid and add to connector so they are "linked" together.
    const emitter = createEmitter<ConnectorEventMap>(uid());
    const connector = {
      ...connectorFn({
        // @ts-ignore
        emitter,
        chains: [{ id: 1, name: 'Ethereum' }] as any,
        // storage: {} as any,
      }),
      emitter,
      uid: emitter.uid,
    };

    // Start listening for `connect` events on connector setup
    // This allows connectors to "connect" themselves without user interaction (e.g. MetaMask's "Manually connect to current site")
    //
    // emitter.on('connect', this.connect);
    // **** DO NOT add custom event listener: emitter.on('connect', this.connect);
    // because it will cause connector onAccountsChanged not working
    // check details here: https://github.com/wevm/wagmi/blob/main/packages/core/src/connectors/injected.ts#L415

    await connector.setup?.();

    return connector as IWagmiConnectorEvm;
  }

  private connect = (data: EventData<ConnectorEventMap, 'connect'>) => {
    console.log('connect', data);
    // // Disable handling if reconnecting/connecting
    // if (
    //   store.getState().status === 'connecting' ||
    //   store.getState().status === 'reconnecting'
    // )
    //   return

    // store.setState((x) => {
    //   const connector = connectors.getState().find((x) => x.uid === data.uid)
    //   if (!connector) return x
    //   return {
    //     ...x,
    //     connections: new Map(x.connections).set(data.uid, {
    //       accounts: data.accounts as readonly [Address, ...Address[]],
    //       chainId: data.chainId,
    //       connector: connector,
    //     }),
    //     current: data.uid,
    //     status: 'connected',
    //   }
    // })
  };

  private disconnect = (data: EventData<ConnectorEventMap, 'disconnect'>) => {
    console.log('disconnect', data);
    // store.setState((x) => {
    //   const connection = x.connections.get(data.uid)
    //   if (connection) {
    //     connection.connector.emitter.off('change', change)
    //     connection.connector.emitter.off('disconnect', disconnect)
    //     connection.connector.emitter.on('connect', connect)
    //   }
    //   x.connections.delete(data.uid)
    //   if (x.connections.size === 0)
    //     return {
    //       ...x,
    //       connections: new Map(),
    //       current: undefined,
    //       status: 'disconnected',
    //     }
    //   const nextConnection = x.connections.values().next().value as Connection
    //   return {
    //     ...x,
    //     connections: new Map(x.connections),
    //     current: nextConnection.connector.uid,
    //   }
    // })
  };

  listAllWallets() {
    const uuidOneKeyInjectAsMetamask = '7677b54f-3486-46e2-4e37-bf8747814f';
    // const uuidOneKeyInjectAsMetamask = '';
    const allProvidersDetail = this.mipdStore
      .getProviders()
      .filter((item) => item.info.uuid !== uuidOneKeyInjectAsMetamask);

    // return allProvidersDetail;
    return uniqBy(allProvidersDetail, (item) => item.info.rdns);
  }

  async createEvmConnector({
    evmEIP6963,
    evmInjected,
  }: {
    evmEIP6963?: IDBExternalConnectionInfoEvmEIP6963;
    evmInjected?: IDBExternalConnectionInfoEvmInjected;
  }) {
    let connectorFn;
    if (evmEIP6963?.info) {
      connectorFn = this.providerDetailToConnector({
        info: evmEIP6963?.info,
      });
    }
    if (evmInjected) {
      connectorFn = injected();
    }
    if (!connectorFn) {
      throw new Error('connectorFn is not defined');
    }
    const connector = await this.setup(connectorFn);
    // TODO cache connector and destroy
    return connector;
  }
}
