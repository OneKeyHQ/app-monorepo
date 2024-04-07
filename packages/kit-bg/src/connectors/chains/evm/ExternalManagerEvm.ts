import { injected } from '@wagmi/core';
import { createStore as createMipd } from 'mipd';

import type { EventData } from '@onekeyhq/shared/src/eventBus/WagmiEventEmitter';
import { createEmitter } from '@onekeyhq/shared/src/eventBus/WagmiEventEmitter';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { uidForWagmi } from '@onekeyhq/shared/src/utils/miscUtils';
import type {
  IExternalConnectionInfo,
  IExternalConnectionInfoEvmEIP6963,
  IExternalConnectorEvm,
  IExternalWalletProviderEvm,
} from '@onekeyhq/shared/types/externalWallet.types';

import type { ConnectorEventMap, CreateConnectorFn } from '@wagmi/core';
import type { Store } from 'mipd';

export class ExternalManagerEvm {
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

  providerDetailToConnector(
    providerDetail: IExternalConnectionInfoEvmEIP6963,
  ): CreateConnectorFn<any> {
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
  async setup(
    connectorFn: CreateConnectorFn<IExternalWalletProviderEvm>,
    connectionInfo: IExternalConnectionInfo,
  ): Promise<IExternalConnectorEvm> {
    // Set up emitter with uid and add to connector so they are "linked" together.
    const emitter = createEmitter<ConnectorEventMap>(uidForWagmi());
    const connector: IExternalConnectorEvm = {
      ...connectorFn({
        // @ts-ignore
        emitter,
        chains: [{ id: 1, name: 'Ethereum' }] as any,
        // storage: {} as any,
      }),
      emitter,
      uid: emitter.uid,
      connectionInfo,
    };

    // Start listening for `connect` events on connector setup
    // This allows connectors to "connect" themselves without user interaction (e.g. MetaMask's "Manually connect to current site")
    //
    // emitter.on('connect', this.connect);
    // **** DO NOT add custom event listener: emitter.on('connect', this.connect);
    // because it will cause connector onAccountsChanged not working
    // check details here: https://github.com/wevm/wagmi/blob/main/packages/core/src/connectors/injected.ts#L415

    await connector.setup?.();

    return connector;
  }

  getProviders() {
    return this.mipdStore.getProviders();
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
}
