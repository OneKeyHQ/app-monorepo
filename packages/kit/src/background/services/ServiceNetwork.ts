import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

import { fetchChainList } from '@onekeyhq/engine/src/managers/network';
import {
  AddNetworkParams,
  Network,
  UpdateNetworkParams,
} from '@onekeyhq/engine/src/types/network';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  GeneralInitialState,
  changeActiveNetwork,
} from '../../store/reducers/general';
import { updateNetworks } from '../../store/reducers/runtime';
import { updateUserSwitchNetworkFlag } from '../../store/reducers/status';
import { wait } from '../../utils/helper';
import { backgroundClass, backgroundMethod } from '../decorators';
import ProviderApiBase from '../providers/ProviderApiBase';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceNetwork extends ServiceBase {
  @backgroundMethod()
  async changeActiveNetwork(
    networkId: NonNullable<GeneralInitialState['activeNetworkId']>,
  ) {
    const { appSelector, serviceAccount } = this.backgroundApi;
    const { activeWalletId, activeNetworkId } = appSelector((s) => s.general);
    const networks: Network[] = appSelector((s) => s.runtime.networks);
    const previousNetwork = networks.find(
      (network) => network.id === activeNetworkId,
    );
    const newNetwork = networks.find((network) => network.id === networkId);

    this.backgroundApi.engine.notifyChainChanged(
      networkId,
      activeNetworkId ?? '',
    );
    this.backgroundApi.dispatch(changeActiveNetwork(networkId));
    this.notifyChainChanged();

    if (previousNetwork?.impl !== newNetwork?.impl) {
      // 当切换了不同 impl 类型的链时更新 accounts 内容
      const accounts = await serviceAccount.reloadAccountsByWalletIdNetworkId(
        activeWalletId,
        networkId,
      );
      const firstAccount = accounts && accounts[0];
      // TODO cache last active account of network, NOT hardcode to firstAccount
      if (firstAccount) {
        await serviceAccount.changeActiveAccount({
          accountId: firstAccount.id,
          walletId: activeWalletId,
        });
      }
    }
    return newNetwork;
  }

  @backgroundMethod()
  async notifyChainChanged(): Promise<void> {
    await wait(600);
    Object.values(this.backgroundApi.providers).forEach(
      (provider: ProviderApiBase) => {
        provider.notifyDappChainChanged({
          send: this.backgroundApi.sendForProvider(provider.providerName),
        });
      },
    );
    await this.backgroundApi.walletConnect.notifySessionChanged();
    // emit at next tick
    await wait(100);
    appEventBus.emit(AppEventBusNames.NetworkChanged);
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
    await this.fetchNetworks();
    return engine.listNetworks(true);
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
  async updateNetwork(
    networkid: string,
    params: UpdateNetworkParams,
    isUserSwitched = true,
  ) {
    const { engine, appSelector, dispatch } = this.backgroundApi;
    const network = await engine.updateNetwork(networkid, params);
    if (params.rpcURL) {
      const { userSwitchedNetworkRpcFlag } = appSelector((s) => s.status);
      if (isUserSwitched && !userSwitchedNetworkRpcFlag?.[networkid]) {
        dispatch(
          updateUserSwitchNetworkFlag({ networkId: networkid, flag: true }),
        );
        await wait(600);
      }
    }
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
    return engine.proxyJsonRPCCall(networkId, request);
  }

  @backgroundMethod()
  async preAddNetwork(rpcURL: string) {
    const { engine } = this.backgroundApi;
    return engine.preAddNetwork(rpcURL);
  }

  @backgroundMethod()
  async getRPCEndpointStatus(rpcURL: string, networkId: string) {
    const { engine } = this.backgroundApi;
    return engine.getRPCEndpointStatus(rpcURL, networkId);
  }

  @backgroundMethod()
  initCheckingNetwork(networks: Network[]): string | null {
    const { appSelector } = this.backgroundApi;
    // first time read from local storage
    const previousActiveNetworkId: string | null = appSelector(
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

  @backgroundMethod()
  getCustomRpcUrls(networkId: string) {
    const { appSelector } = this.backgroundApi;
    return Promise.resolve(
      appSelector((s) => s.settings.customNetworkRpcMap?.[networkId] || []),
    );
  }

  @backgroundMethod()
  fetchChainList(params: {
    query: string;
    showTestNet: boolean;
    page: number;
    pageSize: number;
  }) {
    return fetchChainList(params);
  }

  @backgroundMethod()
  async getNetworkWithRuntime(networkId: string) {
    const { appSelector } = this.backgroundApi;
    const network = appSelector((s) =>
      s.runtime.networks.find((n) => n.id === networkId),
    );
    return Promise.resolve(network);
  }
}

export default ServiceNetwork;
