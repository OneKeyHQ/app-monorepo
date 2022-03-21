import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

import {
  AddNetworkParams,
  UpdateNetworkParams,
} from '@onekeyhq/engine/src/types/network';

import {
  GeneralInitialState,
  changeActiveNetwork,
} from '../../store/reducers/general';
import { updateNetworkMap } from '../../store/reducers/network';
import { backgroundClass, backgroundMethod } from '../decorators';
import ProviderApiBase from '../providers/ProviderApiBase';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNetwork extends ServiceBase {
  @backgroundMethod()
  changeActiveNetwork(
    network: NonNullable<GeneralInitialState['activeNetwork']>,
  ) {
    this.backgroundApi.dispatch(changeActiveNetwork(network));
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
    dispatch(updateNetworkMap(res));
  }

  @backgroundMethod()
  async fetchNetworks() {
    const { engine, dispatch } = this.backgroundApi;
    const networks = await engine.listNetworks(false);
    dispatch(updateNetworkMap(networks));
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
}

export default ServiceNetwork;
