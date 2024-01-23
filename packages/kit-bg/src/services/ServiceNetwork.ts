/* eslint-disable @typescript-eslint/require-await */
import { debounce } from 'lodash';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  fetchChainList,
  isAllNetworks,
} from '@onekeyhq/engine/src/managers/network';
import {
  getPresetNetworks,
  initNetworkList,
  networkIsPreset,
} from '@onekeyhq/engine/src/presets/network';
import type {
  AddNetworkParams,
  Network,
  UpdateNetworkParams,
} from '@onekeyhq/engine/src/types/network';
import type { IFeeInfoUnit } from '@onekeyhq/engine/src/vaults/types';
import type { GeneralInitialState } from '@onekeyhq/kit/src/store/reducers/general';
import { changeActiveNetwork } from '@onekeyhq/kit/src/store/reducers/general';
import reducerAccountSelector from '@onekeyhq/kit/src/store/reducers/reducerAccountSelector';
import { updateNetworks } from '@onekeyhq/kit/src/store/reducers/runtime';
import {
  clearNetworkCustomRpcs,
  updateCustomNetworkRpc,
} from '@onekeyhq/kit/src/store/reducers/settings';
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
  IMPL_EVM,
  getSupportedFakeNetworks,
  getSupportedImpls,
} from '@onekeyhq/shared/src/engine/engineConsts';
import {
  AppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import NetInfo from '@onekeyhq/shared/src/modules3rdParty/@react-native-community/netinfo';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { ENetworkStatus } from '@onekeyhq/shared/types';

import ServiceBase from './ServiceBase';

import type ProviderApiBase from '../providers/ProviderApiBase';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

const accountSelectorActions = reducerAccountSelector.actions;

NetInfo.configure({
  reachabilityShouldRun: () => false,
});

const rpcUrlSupportBatchCheckTimestampMap: Map<string, number> = new Map();

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
    const { appSelector, serviceAccount, engine } = this.backgroundApi;
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
      const firstAccount = accounts?.[0] ?? null;
      await serviceAccount.changeActiveAccount({
        accountId: firstAccount?.id ?? null,
        walletId: activeWalletId,
        extraActions: [...changeActiveNetworkActions], // dispatch batch actions
        // as reloadAccountsByWalletIdNetworkId() has been called before
        shouldReloadAccountsWhenWalletChanged: false,
      });
      shouldDispatch = false;
    }
    // Refresh the list of accounts only, without switching activeAccount
    if (shouldReloadAccountList) {
      await serviceAccount.reloadAccountsByWalletIdNetworkId(
        activeWalletId,
        networkId,
      );
    }
    if (shouldDispatch) {
      this.backgroundApi.dispatch(...changeActiveNetworkActions);
    }
    await engine.updateOnlineTokens(networkId, false);
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
    this.notifyChainChanged();
    dispatch(updateNetworks(res));
  }

  @backgroundMethod()
  async initNetworks() {
    const { engine } = this.backgroundApi;
    await initNetworkList();
    await this.syncPresetNetworks();
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
    const { engine, dispatch } = this.backgroundApi;
    const network = await engine.addNetwork(impl, params);
    dispatch(
      updateCustomNetworkRpc({
        networkId: network.id,
        type: 'add',
        rpc: params.rpcURL,
      }),
    );
    this.fetchNetworks();
    return network;
  }

  @backgroundMethod()
  async deleteNetwork(networkId: string) {
    const { engine, dispatch } = this.backgroundApi;
    await engine.deleteNetwork(networkId);
    dispatch(clearNetworkCustomRpcs({ networkId }));
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
  async getNetworkCustomFee(networkId: string) {
    const customFee = await this.backgroundApi.engine.dbApi.getCustomFee(
      networkId,
    );
    if (customFee) {
      return {
        price: customFee.price,
        eip1559: customFee.eip1559,
        price1559: {
          baseFee: customFee.price1559?.baseFee,
          maxFeePerGas: customFee.price1559?.maxFeePerGas,
          maxPriorityFeePerGas: customFee.price1559?.maxPriorityFeePerGas,
        },
        isBtcForkChain: customFee.isBtcForkChain,
        feeRate: customFee.feeRate,
        btcFee: customFee.btcFee,
      } as IFeeInfoUnit;
    }
  }

  @backgroundMethod()
  async updateNetworkCustomFee(
    networkId: string,
    customFee: IFeeInfoUnit | null | undefined,
  ) {
    this.backgroundApi.engine.dbApi.updateCustomFee(networkId, customFee);
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
    let networkId: string | undefined | null = _networkId;
    const { appSelector, engine, dispatch, serviceApp } = this.backgroundApi;
    if (!serviceApp.isAppInited) {
      await serviceApp.waitForAppInited({
        logName: 'measureRpcStatus',
      });
    }
    if (!networkId) {
      networkId = appSelector((s) => s.general.activeNetworkId);
    }
    if (!networkId || isAllNetworks(networkId)) {
      return;
    }
    let status: IRpcStatus = {
      responseTime: undefined,
      latestBlock: undefined,
    };
    const network = await engine.getNetwork(networkId);
    const url = network.rpcURL;
    try {
      if (networkId.startsWith(IMPL_EVM)) {
        const vault = await engine.getChainOnlyVault(networkId);
        status = await vault.checkRpcBatchSupport(url);
      } else {
        status = await this.getRPCEndpointStatus(url, networkId, false);
      }

      if (networkId.startsWith(IMPL_EVM)) {
        const whitelistHosts =
          await simpleDb.setting.getRpcBatchFallbackWhitelistHosts();

        const item = whitelistHosts.find((n) => url.includes(n.url));
        const isRpcInWhitelistHost = !!item;

        const ts = rpcUrlSupportBatchCheckTimestampMap.get(url);
        if (status.rpcBatchSupported === false && !isRpcInWhitelistHost) {
          if (!ts || Date.now() - ts > getTimeDurationMs({ day: 1 })) {
            debugLogger.http.info('add rpc to whitelistHosts', url, ts);
            await simpleDb.setting.addRpcBatchFallbackWhitelistHosts(url);
          }
        }

        if (status.rpcBatchSupported !== false) {
          rpcUrlSupportBatchCheckTimestampMap.set(url, Date.now());
        }

        if (
          status.rpcBatchSupported !== false &&
          isRpcInWhitelistHost &&
          item.type === 'custom'
        ) {
          debugLogger.http.info('remove rpc from whitelistHosts', url, ts);
          await simpleDb.setting.removeRpcBatchFallbackWhitelistHosts(url);
        }
      }
    } catch (error) {
      // pass
      debugLogger.http.error('measureRpcStatus ERROR', error);
    }

    dispatch(
      setRpcStatus({
        networkId,
        status,
      }),
    );

    return status;
  }

  @backgroundMethod()
  async migrateServerNetworks(networks: IServerNetwork[]) {
    if (!networks?.length) {
      return;
    }
    await simpleDb.serverNetworks.updateNetworks(networks);
    await this.initNetworks();
  }

  async checkDisabledPresetNetworks() {
    const { engine, appSelector } = this.backgroundApi;
    const dbNetworks = await engine.dbApi.listNetworks();
    const presetNetworksList = Object.values(getPresetNetworks());
    const networksToRemoved = dbNetworks.filter(({ id }) => {
      const preset = presetNetworksList.find((p) => p.id === id);
      if (!preset) {
        return false;
      }
      if (preset.status === ENetworkStatus.TRASH) {
        return true;
      }
      return false;
    });

    const currentNetworkId = appSelector((s) => s.general.activeNetworkId);

    const firstAvailableNetwork = dbNetworks.find(
      (n) => !networksToRemoved.find((network) => network.id === n.id),
    );

    for (const n of networksToRemoved) {
      debugLogger.engine.warn(
        `[checkDisabledPresetNetworks] remove network: ${n.id}`,
      );
      if (currentNetworkId === n.id && firstAvailableNetwork) {
        debugLogger.engine.warn(
          `[checkDisabledPresetNetworks] switch network: ${n.id}`,
        );
        // TODO: Prompt user that current network is changed
        await this.changeActiveNetwork(firstAvailableNetwork.id);
      }
      await engine.dbApi.deleteNetwork(n.id);
    }
  }

  async syncPresetNetworks(): Promise<void> {
    const { engine } = this.backgroundApi;
    await this.checkDisabledPresetNetworks();
    try {
      const defaultNetworkList: Array<[string, boolean]> = [];
      const dbNetworks = await engine.dbApi.listNetworks();
      const dbNetworkMap = Object.fromEntries(
        dbNetworks.map((dbNetwork) => [dbNetwork.id, dbNetwork.enabled]),
      );

      const presetNetworksList = Object.values(getPresetNetworks())
        .filter((n) => n.status !== ENetworkStatus.TRASH)
        .sort((a, b) => {
          const aPosition =
            (a.extensions || {}).position || Number.MAX_SAFE_INTEGER;
          const bPosition =
            (b.extensions || {}).position || Number.MAX_SAFE_INTEGER;
          if (aPosition > bPosition) {
            return 1;
          }
          if (aPosition < bPosition) {
            return -1;
          }
          return a.name > b.name ? 1 : -1;
        });

      for (const network of presetNetworksList) {
        if (
          getSupportedImpls().has(network.impl) ||
          getSupportedFakeNetworks().has(network.impl)
        ) {
          const existingStatus = dbNetworkMap[network.id];
          if (typeof existingStatus !== 'undefined') {
            defaultNetworkList.push([network.id, existingStatus]);
          } else {
            await engine.dbApi.addNetwork({
              id: network.id,
              name: network.name,
              impl: network.impl,
              symbol: network.symbol,
              logoURI: network.logoURI,
              enabled: network.enabled,
              feeSymbol: network.feeSymbol,
              decimals: network.decimals,
              feeDecimals: network.feeDecimals,
              balance2FeeDecimals: network.balance2FeeDecimals,
              rpcURL: network.presetRpcURLs[0],
              position: 0,
            });
            dbNetworkMap[network.id] = network.enabled;
            defaultNetworkList.push([network.id, network.enabled]);
          }
        }
      }

      const context = await engine.dbApi.getContext();
      if (
        typeof context !== 'undefined' &&
        context?.networkOrderChanged === true
      ) {
        return;
      }

      const specifiedNetworks = new Set(defaultNetworkList.map(([id]) => id));
      dbNetworks.forEach((dbNetwork) => {
        if (!specifiedNetworks.has(dbNetwork.id)) {
          defaultNetworkList.push([dbNetwork.id, dbNetwork.enabled]);
        }
      });

      await engine.dbApi.updateNetworkList(defaultNetworkList, true);
    } catch (error) {
      console.error(error);
    }
  }

  @backgroundMethod()
  async getPresetNetworks() {
    return getPresetNetworks();
  }

  @backgroundMethod()
  async fetchRpcChainId({
    url,
    networkId,
  }: {
    url: string;
    networkId: string;
  }) {
    const { engine } = this.backgroundApi;

    const vault = await engine.getChainOnlyVault(networkId);

    return vault.fetchRpcChainId(url);
  }

  @backgroundMethod()
  async networkIsPreset(networkId: string) {
    return networkIsPreset(networkId);
  }
}

export default ServiceNetwork;
