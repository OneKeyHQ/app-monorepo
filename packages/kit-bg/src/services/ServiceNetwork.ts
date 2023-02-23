import NetInfo from '@react-native-community/netinfo';
import { debounce } from 'lodash';

import { fetchChainList } from '@onekeyhq/engine/src/managers/network';
import type {
  AddNetworkParams,
  Network,
  UpdateNetworkParams,
} from '@onekeyhq/engine/src/types/network';
import type { GeneralInitialState } from '@onekeyhq/kit/src/store/reducers/general';
import { changeActiveNetwork } from '@onekeyhq/kit/src/store/reducers/general';
import reducerAccountSelector from '@onekeyhq/kit/src/store/reducers/reducerAccountSelector';
import { updateNetworks } from '@onekeyhq/kit/src/store/reducers/runtime';
import type { IRpcStatus } from '@onekeyhq/kit/src/store/reducers/status';
import {
  setRpcStatus,
  updateUserSwitchNetworkFlag,
} from '@onekeyhq/kit/src/store/reducers/status';
import { getTimeDurationMs, wait } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
  bindThis,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import ServiceBase from './ServiceBase';

import type ProviderApiBase from '../providers/ProviderApiBase';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

const accountSelectorActions = reducerAccountSelector.actions;

NetInfo.configure({
  reachabilityShouldRun: () => false,
});

@backgroundClass()
class ServiceNetwork extends ServiceBase {
  rpcMeasureInterval: NodeJS.Timeout | null = null;

  @bindThis()
  registerEvents() {
    appEventBus.on(
      AppEventBusNames.NetworkChanged,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      this.measureRpcStatus,
    );

    this.rpcMeasureInterval = setInterval(
      // eslint-disable-next-line @typescript-eslint/unbound-method
      this.measureRpcStatus,
      getTimeDurationMs({ minute: 1 }),
    );

    NetInfo.addEventListener(() => {
      this.measureRpcStatus();
    });

    this.measureRpcStatus();
  }

  @backgroundMethod()
  async changeActiveNetwork(
    networkId: NonNullable<GeneralInitialState['activeNetworkId']>,
  ) {
    const { appSelector, serviceAccount } = this.backgroundApi;
    const { activeWalletId, activeNetworkId, activeAccountId } = appSelector(
      (s) => s.general,
    );
    const networks: Network[] = appSelector((s) => s.runtime.networks);
    const previousNetwork = networks.find(
      (network) => network.id === activeNetworkId,
    );
    const newNetwork = networks.find((network) => network.id === networkId);

    if (newNetwork && !newNetwork?.enabled) {
      await this.updateNetworks(
        networks.map((n) => [n.id, n.id === newNetwork.id ? true : n.enabled]),
      );
      newNetwork.enabled = true;
    }

    this.backgroundApi.engine.notifyChainChanged(
      networkId,
      activeNetworkId ?? '',
    );
    const changeActiveNetworkActions = [
      changeActiveNetwork(networkId),
      accountSelectorActions.updateSelectedNetworkId(networkId),
    ];
    let shouldDispatch = true;
    this.notifyChainChanged();

    const implChange = previousNetwork?.impl !== newNetwork?.impl;
    // Use symbol to determine chainId changes
    const chainIdChange = previousNetwork?.symbol !== newNetwork?.symbol;
    const forceRefreshAccount =
      chainIdChange && serviceAccount.shouldForceRefreshAccount(newNetwork?.id);
    const { shouldChangeActiveAccount, shouldReloadAccountList } =
      await serviceAccount.shouldChangeAccountWhenNetworkChanged({
        previousNetwork,
        newNetwork,
        activeAccountId,
      });

    if (implChange || forceRefreshAccount || shouldChangeActiveAccount) {
      // 当切换了不同 impl 类型的链时更新 accounts 内容
      // 有一些特殊的链比如 Cosmos，如果 chainId 改变了，需要更新 accounts 内容
      const accounts = await serviceAccount.reloadAccountsByWalletIdNetworkId(
        activeWalletId,
        networkId,
      );
      const firstAccount = accounts && accounts[0];
      // TODO cache last active account of network, NOT hardcode to firstAccount
      if (firstAccount || forceRefreshAccount) {
        await serviceAccount.changeActiveAccount({
          accountId: firstAccount?.id ?? null,
          walletId: activeWalletId,
          extraActions: [...changeActiveNetworkActions], // dispatch batch actions
          // as reloadAccountsByWalletIdNetworkId() has been called before
          shouldReloadAccountsWhenWalletChanged: false,
        });
        shouldDispatch = false;
      }
    }
    if (shouldReloadAccountList) {
      await serviceAccount.reloadAccountsByWalletIdNetworkId(
        activeWalletId,
        networkId,
      );
    }
    if (shouldDispatch) {
      this.backgroundApi.dispatch(...changeActiveNetworkActions);
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
  async getRPCEndpointStatus(
    rpcURL: string,
    networkId: string,
    useCache = true,
  ) {
    const { engine } = this.backgroundApi;
    return engine.getRPCEndpointStatus(rpcURL, networkId, useCache);
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

  measureRpcStatus = debounce(
    // eslint-disable-next-line @typescript-eslint/unbound-method
    this._measureRpcStatus,
    getTimeDurationMs({ seconds: 5 }),
    {
      leading: true,
      trailing: true,
    },
  );

  @bindThis()
  @backgroundMethod()
  async _measureRpcStatus(_networkId?: string) {
    console.log('_measureRpcStatus');
    let networkId: string | undefined | null = _networkId;
    const { appSelector, engine, dispatch } = this.backgroundApi;
    await this.backgroundApi.serviceApp.waitForAppInited({
      logName: 'measureRpcStatus',
    });
    if (!networkId) {
      networkId = appSelector((s) => s.general.activeNetworkId);
    }
    if (!networkId) {
      return;
    }
    let status: IRpcStatus = {
      latestBlock: undefined,
      responseTime: undefined,
    };
    const network = await engine.getNetwork(networkId);
    try {
      status = await this.getRPCEndpointStatus(
        network.rpcURL,
        networkId,
        false,
      );
    } catch (error) {
      // pass
    }
    dispatch(
      setRpcStatus({
        networkId,
        status,
      }),
    );

    return status;
  }
}

export default ServiceNetwork;
