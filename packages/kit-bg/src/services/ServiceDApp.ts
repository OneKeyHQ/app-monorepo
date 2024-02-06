import { debounce } from 'lodash';

import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
// TODO: move to shared
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { ERootRoutes } from '@onekeyhq/kit/src/routes/enum';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { EDAppConnectionModal } from '@onekeyhq/kit/src/views/DAppConnection/router';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkImplsFromDappScope } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ensureSerializable } from '@onekeyhq/shared/src/utils/assertUtils';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { getValidUnsignedMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import {
  EAccountSelectorSceneName,
  type IDappSourceInfo,
} from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';
import type {
  IConnectionAccountInfo,
  IConnectionItemWithStorageType,
  IGetDAppAccountInfoParams,
  IStorageType,
} from '@onekeyhq/shared/types/dappConnection';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type ProviderApiBase from '../providers/ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

function buildModalRouteParams({
  screens = [],
  routeParams,
}: {
  screens: string[];
  routeParams: Record<string, any>;
}) {
  const modalParams: { screen: any; params: any } = {
    screen: null,
    params: {},
  };
  let paramsCurrent = modalParams;
  let paramsLast = modalParams;
  screens.forEach((screen) => {
    paramsCurrent.screen = screen;
    paramsCurrent.params = {};
    paramsLast = paramsCurrent;
    paramsCurrent = paramsCurrent.params;
  });
  paramsLast.params = routeParams;
  return modalParams;
}

function getQueryDAppAccountParams(params: IGetDAppAccountInfoParams) {
  const { scope, isWalletConnectRequest, options = {} } = params;

  const storageType: IStorageType = isWalletConnectRequest
    ? 'walletConnect'
    : 'injectedProvider';
  let networkImpl: string | undefined = '';
  if (options.networkImpl) {
    networkImpl = options.networkImpl;
  } else if (scope) {
    networkImpl = getNetworkImplsFromDappScope(scope)?.[0];
  }

  if (!networkImpl) {
    throw new Error('networkImpl not found');
  }
  return {
    storageType,
    networkImpl,
  };
}

@backgroundClass()
class ServiceDApp extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  public async openModal({
    request,
    screens = [],
    params = {},
    fullScreen,
  }: {
    request: IJsBridgeMessagePayload;
    screens: any[];
    params?: any;
    fullScreen?: boolean;
  }) {
    return new Promise((resolve, reject) => {
      if (!request.origin) {
        throw new Error('origin is required');
      }
      if (!request.scope) {
        throw new Error('scope is required');
      }
      const id = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      const modalScreens = screens;
      const routeNames = [
        fullScreen ? ERootRoutes.iOSFullScreen : ERootRoutes.Modal,
        ...modalScreens,
      ];
      const $sourceInfo: IDappSourceInfo = {
        id,
        origin: request.origin,
        hostname: uriUtils.getHostNameFromUrl({ url: request.origin }),
        scope: request.scope,
        data: request.data as any,
      };

      const routeParams = {
        // stringify required, nested object not working with Ext route linking
        query: JSON.stringify(
          {
            $sourceInfo,
            ...params,
            _$t: Date.now(),
          },
          (key, value) =>
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            typeof value === 'bigint' ? value.toString() : value,
        ),
      };

      const modalParams = buildModalRouteParams({
        screens: routeNames,
        routeParams,
      });

      ensureSerializable(modalParams);

      this._openModalByRouteParamsDebounced({
        routeNames,
        routeParams,
        modalParams,
      });
    });
  }

  _openModalByRouteParams = ({
    modalParams,
    routeParams,
    routeNames,
  }: {
    routeNames: any[];
    routeParams: { query: string };
    modalParams: { screen: any; params: any };
  }) => {
    if (platformEnv.isExtension) {
      // TODO: openStandaloneWindow
      // extUtils.openStandaloneWindow({
      //   routes: routeNames,
      //   params: routeParams,
      // });
      throw new Error('not implemented');
    } else {
      const doOpenModal = () =>
        global.$navigationRef.current?.navigate(
          modalParams.screen,
          modalParams.params,
        );
      console.log('modalParams: ', modalParams);
      // TODO remove timeout after dapp request queue implemented.
      doOpenModal();
    }
  };

  _openModalByRouteParamsDebounced = debounce(
    this._openModalByRouteParams,
    800,
    {
      leading: false,
      trailing: true,
    },
  );

  @backgroundMethod()
  async openConnectionModal(request: IJsBridgeMessagePayload) {
    const result = await this.openModal({
      request,
      screens: [
        EModalRoutes.DAppConnectionModal,
        EDAppConnectionModal.ConnectionModal,
      ],
      fullScreen: true,
    });

    return result;
  }

  @backgroundMethod()
  openSignMessageModal({
    request,
    unsignedMessage,
    accountId,
    networkId,
  }: {
    request: IJsBridgeMessagePayload;
    unsignedMessage: IUnsignedMessage;
    accountId: string;
    networkId: string;
  }) {
    if (!accountId || !networkId) {
      throw new Error('accountId and networkId required');
    }
    return this.openModal({
      request,
      screens: [EModalRoutes.DAppConnectionModal, 'SignMessageModal'],
      params: {
        unsignedMessage,
        accountId,
        networkId,
      },
      fullScreen: true,
    });
  }

  // connection allowance
  @backgroundMethod()
  async getAccountSelectorNum(params: IGetDAppAccountInfoParams) {
    const { storageType, networkImpl } = getQueryDAppAccountParams(params);
    return this.backgroundApi.simpleDb.dappConnection.getAccountSelectorNum(
      params.origin,
      networkImpl,
      storageType,
    );
  }

  @backgroundMethod()
  async deleteExistSessionBeforeConnect({
    origin,
    storageType,
  }: {
    origin: string;
    storageType: IStorageType;
  }) {
    const rawData =
      await this.backgroundApi.simpleDb.dappConnection.getRawData();
    if (
      storageType === 'walletConnect' &&
      rawData?.data.injectedProvider?.[origin]
    ) {
      await this.disconnectWebsite({ origin, storageType: 'injectedProvider' });
    } else if (rawData?.data.walletConnect?.[origin]) {
      await this.disconnectWebsite({ origin, storageType: 'walletConnect' });
    }
  }

  @backgroundMethod()
  async saveConnectionSession({
    origin,
    accountsInfo,
    storageType,
    walletConnectTopic,
  }: {
    origin: string;
    accountsInfo: IConnectionAccountInfo[];
    storageType: IStorageType;
    walletConnectTopic?: string;
  }) {
    if (storageType === 'walletConnect' && !walletConnectTopic) {
      throw new Error('walletConnectTopic is required');
    }
    const { simpleDb, serviceDiscovery } = this.backgroundApi;
    await this.deleteExistSessionBeforeConnect({ origin, storageType });
    await simpleDb.dappConnection.upsertConnection({
      origin,
      accountsInfo,
      imageURL: await serviceDiscovery.getWebsiteIcon(origin, 128),
      storageType,
      walletConnectTopic,
    });
    appEventBus.emit(EAppEventBusNames.DAppConnectUpdate, undefined);
  }

  @backgroundMethod()
  async updateConnectionSession({
    origin,
    accountSelectorNum,
    updatedAccountInfo,
    storageType,
  }: {
    origin: string;
    accountSelectorNum: number;
    updatedAccountInfo: IConnectionAccountInfo;
    storageType: IStorageType;
  }) {
    await this.backgroundApi.simpleDb.dappConnection.updateConnectionAccountInfo(
      {
        origin,
        accountSelectorNum,
        updatedAccountInfo,
        storageType,
      },
    );
  }

  @backgroundMethod()
  async disconnectWebsite({
    origin,
    storageType,
  }: {
    origin: string;
    storageType: IStorageType;
  }) {
    await this.backgroundApi.simpleDb.dappConnection.deleteConnection(
      origin,
      storageType,
    );
    appEventBus.emit(EAppEventBusNames.DAppConnectUpdate, undefined);
  }

  @backgroundMethod()
  async disconnectAllWebsites() {
    await this.backgroundApi.serviceWalletConnect.disconnectAllSessions();
    await this.backgroundApi.simpleDb.dappConnection.clearRawData();
    appEventBus.emit(EAppEventBusNames.DAppConnectUpdate, undefined);
  }

  async getConnectedAccountsInfo({
    origin,
    scope,
    isWalletConnectRequest,
    options,
  }: IGetDAppAccountInfoParams) {
    const { storageType, networkImpl } = getQueryDAppAccountParams({
      origin,
      scope,
      isWalletConnectRequest,
      options,
    });
    const accountsInfo =
      await this.backgroundApi.simpleDb.dappConnection.findAccountsInfoByOriginAndScope(
        origin,
        storageType,
        networkImpl,
      );
    if (!accountsInfo) {
      return null;
    }
    return accountsInfo;
  }

  @backgroundMethod()
  async getConnectedAccounts(params: IGetDAppAccountInfoParams) {
    const accountsInfo = await this.getConnectedAccountsInfo(params);
    if (!accountsInfo) return null;
    const result = accountsInfo.map(async (accountInfo) => {
      const { accountId, networkId } = accountInfo;
      const account = await this.backgroundApi.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      return {
        account,
        accountInfo,
      };
    });
    return Promise.all(result);
  }

  @backgroundMethod()
  async dAppGetConnectedAccountsInfo(request: IJsBridgeMessagePayload): Promise<
    | {
        account: INetworkAccount;
        accountInfo?: Partial<IConnectionAccountInfo>;
      }[]
    | null
  > {
    if (!request.origin) {
      throw web3Errors.provider.unauthorized('origin is required');
    }
    const accountsInfo = await this.getConnectedAccounts({
      origin: request.origin ?? '',
      scope: request.scope,
    });
    if (
      !accountsInfo ||
      (Array.isArray(accountsInfo) && !accountsInfo.length)
    ) {
      return null;
    }
    return accountsInfo;
  }

  @backgroundMethod()
  async getAllConnectedAccountsByOrigin(origin: string) {
    return this.backgroundApi.simpleDb.dappConnection.findAccountsInfoByOrigin(
      origin,
    );
  }

  @backgroundMethod()
  async getAllConnectedList(): Promise<IConnectionItemWithStorageType[]> {
    const rawData =
      await this.backgroundApi.simpleDb.dappConnection.getRawData();
    const injectedProviders = rawData?.data?.injectedProvider
      ? Object.values(rawData.data.injectedProvider).map((i) => ({
          ...i,
          storageType: 'injectedProvider',
        }))
      : [];

    let walletConnects: IConnectionItemWithStorageType[] = [];
    const activeSessions =
      await this.backgroundApi.serviceWalletConnect.getActiveSessions();
    const activeSessionTopics = new Set(Object.keys(activeSessions ?? {}));
    const disconnectPromises = [];
    if (rawData?.data?.walletConnect) {
      const walletConnectEntries = Object.entries(rawData.data.walletConnect);
      // Collect all required asynchronous disconnect operations
      for (const [key, value] of walletConnectEntries) {
        if (
          value.walletConnectTopic &&
          !activeSessionTopics.has(value.walletConnectTopic)
        ) {
          disconnectPromises.push(
            this.disconnectWebsite({
              origin: key,
              storageType: 'walletConnect',
            }),
          );
        }
      }

      await Promise.all(disconnectPromises);

      // Re-filter walletConnects to only retain active sessions
      walletConnects = walletConnectEntries
        .filter(([, value]) =>
          activeSessionTopics.has(value.walletConnectTopic ?? ''),
        )
        .map(([, value]) => ({ ...value, storageType: 'walletConnect' }));
    }
    const allConnections = [...injectedProviders, ...walletConnects];

    return allConnections as IConnectionItemWithStorageType[];
  }

  @backgroundMethod()
  async getConnectedNetworks(request: IJsBridgeMessagePayload) {
    const accountsInfo = await this.getConnectedAccountsInfo({
      origin: request.origin ?? '',
      scope: request.scope,
      isWalletConnectRequest: request.isWalletConnectRequest,
    });
    if (!accountsInfo) {
      throw new Error('Network not found');
    }
    const networkIds = accountsInfo.map((accountInfo) => accountInfo.networkId);
    const { networks } =
      await this.backgroundApi.serviceNetwork.getNetworksByIds({ networkIds });
    return networks;
  }

  @backgroundMethod()
  async switchConnectedNetwork(
    params: IGetDAppAccountInfoParams & {
      newNetworkId: string;
    },
  ) {
    const { newNetworkId } = params;
    const containsNetwork =
      await this.backgroundApi.serviceNetwork.containsNetwork({
        networkId: newNetworkId,
      });
    if (!containsNetwork) {
      throw new Error('Network not found');
    }
    if (await this.shouldSwitchNetwork(params)) {
      return;
    }
    const { storageType, networkImpl } = getQueryDAppAccountParams(params);
    const accountSelectorNum =
      await this.backgroundApi.simpleDb.dappConnection.getAccountSelectorNum(
        params.origin,
        networkImpl,
        storageType,
      );
    console.log('====> accountSelectorNum: ', accountSelectorNum);
    const selectedAccount =
      await this.backgroundApi.simpleDb.accountSelector.getSelectedAccount({
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: params.origin,
        num: accountSelectorNum,
      });
    if (selectedAccount) {
      const { selectedAccount: newSelectedAccount } =
        await this.backgroundApi.serviceAccount.buildActiveAccountInfoFromSelectedAccount(
          {
            selectedAccount: { ...selectedAccount, networkId: newNetworkId },
          },
        );
      await this.backgroundApi.simpleDb.accountSelector.saveSelectedAccount({
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: params.origin,
        num: 0,
        selectedAccount: { ...selectedAccount, networkId: newNetworkId },
      });
      console.log('===>newSelectedAccount: ', newSelectedAccount);
    }

    await this.backgroundApi.simpleDb.dappConnection.updateNetworkId(
      params.origin,
      networkImpl,
      newNetworkId,
      storageType,
    );

    setTimeout(() => {
      appEventBus.emit(EAppEventBusNames.DAppNetworkUpdate, {
        networkId: newNetworkId,
        sceneName: EAccountSelectorSceneName.discover,
        sceneUrl: params.origin,
        num: accountSelectorNum,
      });
    }, 200);
  }

  @backgroundMethod()
  async shouldSwitchNetwork(
    params: IGetDAppAccountInfoParams & {
      newNetworkId: string;
    },
  ) {
    const accountsInfo = await this.getConnectedAccountsInfo(params);
    if (
      !accountsInfo ||
      (Array.isArray(accountsInfo) && !accountsInfo.length)
    ) {
      return false;
    }
    return accountsInfo.some((a) => a.networkId !== params.newNetworkId);
  }

  @backgroundMethod()
  async getInjectProviderConnectedList() {
    const rawData =
      await this.backgroundApi.simpleDb.dappConnection.getRawData();
    if (!rawData?.data.injectedProvider) {
      return [];
    }
    return Object.values(rawData.data.injectedProvider);
  }

  // notification
  @backgroundMethod()
  async notifyDAppAccountsChanged(targetOrigin: string) {
    Object.values(this.backgroundApi.providers).forEach(
      (provider: ProviderApiBase) => {
        provider.notifyDappAccountsChanged({
          send: this.backgroundApi.sendForProvider(provider.providerName),
          targetOrigin,
        });
      },
    );
    return Promise.resolve();
  }

  @backgroundMethod()
  async notifyDAppChainChanged(targetOrigin: string) {
    Object.values(this.backgroundApi.providers).forEach(
      (provider: ProviderApiBase) => {
        provider.notifyDappChainChanged({
          send: this.backgroundApi.sendForProvider(provider.providerName),
          targetOrigin,
        });
      },
    );
    return Promise.resolve();
  }
}

export default ServiceDApp;
