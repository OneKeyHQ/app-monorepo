import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

import {
  AddNetworkParams,
  Network,
  UpdateNetworkParams,
} from '@onekeyhq/engine/src/types/network';

import {
  GeneralInitialState,
  changeActiveNetwork,
} from '../../store/reducers/general';
import { updateNetworks } from '../../store/reducers/runtime';
import { backgroundClass, backgroundMethod } from '../decorators';
import ProviderApiBase from '../providers/ProviderApiBase';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNetwork extends ServiceBase {
  @backgroundMethod()
  changeActiveNetwork(
    networkId: NonNullable<GeneralInitialState['activeNetworkId']>,
  ) {
    const { appSelector, serviceAccount } = this.backgroundApi;
    const { activeWalletId, activeNetworkId } = appSelector((s) => s.general);
    const networks: Network[] = appSelector((s) => s.runtime.networks);
    const previousNetwork = networks.find(
      (network) => network.id === activeNetworkId,
    );
    const newNetwork = networks.find((network) => network.id === networkId);

    if (previousNetwork?.impl !== newNetwork?.impl) {
      // 当切换了不同 impl 类型的链时更新 accounts 内容
      serviceAccount.reloadAccountsByWalletIdNetworkId(
        activeWalletId,
        networkId,
      );
    }
    this.backgroundApi.dispatch(changeActiveNetwork(networkId));
    this.notifyChainChanged();
  }

  @backgroundMethod()
  notifyChainChanged(): void {
    Object.values(this.backgroundApi.providers).forEach(
      (provider: ProviderApiBase) => {
        provider.notifyDappChainChanged({
          send: this.backgroundApi.sendForProvider(provider.providerName),
        });
      },
    );
    this.backgroundApi.walletConnect.notifySessionChanged();
  }

  @backgroundMethod()
  async updateNetworks(networks: [string, boolean][]) {
    const { engine, dispatch } = this.backgroundApi;
    const res = await engine.updateNetworkList(networks);
    dispatch(updateNetworks(res));
  }

  @backgroundMethod()
  async initNetworks() {
    const { engine } = this.backgroundApi;
    await engine.syncPresetNetworks();
    return this.fetchNetworks();
  }

  @backgroundMethod()
  async fetchNetworks() {
    const { engine, dispatch } = this.backgroundApi;
    const networks = await engine.listNetworks(false);
    dispatch(updateNetworks(networks));
    return networks;
  }

  @backgroundMethod()
  async getPresetRpcEndpoints(networkId: string) {
    const { engine } = this.backgroundApi;
    return engine.getRPCEndpoints(networkId);
  }

  @backgroundMethod()
  async updateNetwork(networkid: string, params: UpdateNetworkParams) {
    const { engine } = this.backgroundApi;
    const network = await engine.updateNetwork(networkid, params);
    this.fetchNetworks();
    return network;
  }

  @backgroundMethod()
  async addNetwork(impl: string, params: AddNetworkParams) {
    const { engine } = this.backgroundApi;
    const network = await engine.addNetwork(impl, params);
    this.fetchNetworks();
    return network;
  }

  @backgroundMethod()
  async deleteNetwork(networkId: string) {
    const { engine } = this.backgroundApi;
    await engine.deleteNetwork(networkId);
    this.fetchNetworks();
  }

  @backgroundMethod()
  async rpcCall(networkId: string, request: IJsonRpcRequest) {
    const { engine } = this.backgroundApi;
    return engine.proxyRPCCall(networkId, request);
  }

  @backgroundMethod()
  async preAddNetwork(rpcURL: string) {
    const { engine } = this.backgroundApi;
    return engine.preAddNetwork(rpcURL);
  }

  @backgroundMethod()
  async getRPCEndpointStatus(rpcURL: string, impl: string) {
    const { engine } = this.backgroundApi;
    return engine.getRPCEndpointStatus(rpcURL, impl);
  }

  @backgroundMethod()
  initCheckingNetwork(networks: Network[]): string | null {
    const { appSelector } = this.backgroundApi;
    // first time read from local storage
    const previousActiveNetworkId: string = appSelector(
      (s) => s.general.activeNetworkId,
    );
    const isValidNetworkId = networks.some(
      (network) => network.id === previousActiveNetworkId,
    );
    if (!previousActiveNetworkId || !isValidNetworkId) {
      return networks[0]?.id ?? null;
    }
    return previousActiveNetworkId;
  }
}

export default ServiceNetwork;
