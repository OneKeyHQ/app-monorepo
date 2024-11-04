import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { Semaphore } from 'async-mutex';
import { debounce } from 'lodash';

import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedMessage,
} from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkImplsFromDappScope } from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { parseRPCResponse } from '@onekeyhq/shared/src/request/utils';
import {
  EDAppConnectionModal,
  EModalRoutes,
  EModalSendRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { ensureSerializable } from '@onekeyhq/shared/src/utils/assertUtils';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { buildModalRouteParams } from '@onekeyhq/shared/src/utils/routeUtils';
import { sidePanelState } from '@onekeyhq/shared/src/utils/sidePanelUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { implToNamespaceMap } from '@onekeyhq/shared/src/walletConnect/constant';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IDappSourceInfo, IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IConnectedAccountInfo,
  IConnectionAccountInfo,
  IConnectionItem,
  IConnectionItemWithStorageType,
  IConnectionStorageType,
  IGetDAppAccountInfoParams,
} from '@onekeyhq/shared/types/dappConnection';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IBackgroundApiWebembedCallMessage } from '../apis/IBackgroundApi';
import type ProviderApiBase from '../providers/ProviderApiBase';
import type { IAddEthereumChainParameter } from '../providers/ProviderApiEthereum';
import type ProviderApiPrivate from '../providers/ProviderApiPrivate';
import type { IAccountDeriveTypes, ITransferInfo } from '../vaults/types';
import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';

function getQueryDAppAccountParams(params: IGetDAppAccountInfoParams) {
  const { scope, isWalletConnectRequest, options = {} } = params;

  const storageType: IConnectionStorageType = isWalletConnectRequest
    ? 'walletConnect'
    : 'injectedProvider';
  let networkImpls: string[] | undefined = [];
  if (options.networkImpl) {
    networkImpls = [options.networkImpl];
  } else if (scope) {
    networkImpls = getNetworkImplsFromDappScope(scope);
  }

  if (!networkImpls) {
    throw new Error('networkImpl not found');
  }
  return {
    storageType,
    networkImpls,
  };
}

@backgroundClass()
class ServiceDApp extends ServiceBase {
  private semaphore = new Semaphore(1);

  private existingWindowId: number | null | undefined = null;

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
    defaultLogger.discovery.dapp.dappOpenModal({
      request,
      screens,
      params,
    });
    // Try to open an existing window anyway in the extension
    this.tryOpenExistingExtensionWindow();

    return this.semaphore.runExclusive(async () => {
      try {
        return await new Promise((resolve, reject) => {
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
            isWalletConnectRequest: !!request.isWalletConnectRequest,
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

          void this._openModalByRouteParamsDebounced({
            routeNames,
            routeParams,
            modalParams,
          });
        });
      } finally {
        this.existingWindowId = null;
      }
    });
  }

  _openModalByRouteParams = async ({
    modalParams,
    routeParams,
    routeNames,
  }: {
    routeNames: any[];
    routeParams: { query: string };
    modalParams: { screen: any; params: any };
  }) => {
    if (platformEnv.isExtension) {
      if (sidePanelState.isOpen || platformEnv.isExtensionUiSidePanel) {
        await extUtils.openSidePanel({
          routes: routeNames,
          params: routeParams,
          modalParams,
        });
      } else {
        // check packages/kit/src/routes/config/getStateFromPath.ext.ts for Ext hash route
        const extensionWindow = await extUtils.openStandaloneWindow({
          routes: routeNames,
          params: routeParams,
        });
        this.existingWindowId = extensionWindow.id;
      }
    } else {
      const doOpenModal = () =>
        globalThis.$navigationRef.current?.navigate(
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

  private tryOpenExistingExtensionWindow() {
    if (platformEnv.isExtension && this.existingWindowId) {
      extUtils.focusExistWindow({ windowId: this.existingWindowId });
    }
  }

  @backgroundMethod()
  async openConnectionModal(
    request: IJsBridgeMessagePayload,
    params?: Record<string, any>,
  ) {
    const result = await this.openModal({
      request,
      screens: [
        EModalRoutes.DAppConnectionModal,
        EDAppConnectionModal.ConnectionModal,
      ],
      params,
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
    walletInternalSign,
  }: {
    request: IJsBridgeMessagePayload;
    unsignedMessage: IUnsignedMessage;
    accountId: string;
    networkId: string;
    walletInternalSign?: boolean;
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
        walletInternalSign,
      },
      fullScreen: !platformEnv.isNativeIOS,
    });
  }

  @backgroundMethod()
  async openSignAndSendTransactionModal({
    request,
    encodedTx,
    accountId,
    networkId,
    transfersInfo,
    signOnly,
  }: {
    request: IJsBridgeMessagePayload;
    encodedTx: IEncodedTx;
    accountId: string;
    networkId: string;
    transfersInfo?: ITransferInfo[];
    signOnly?: boolean;
  }): Promise<ISignedTxPro> {
    return this.openModal({
      request,
      screens: [EModalRoutes.SendModal, EModalSendRoutes.SendConfirmFromDApp],
      params: {
        encodedTx,
        transfersInfo,
        accountId,
        networkId,
        signOnly,
      },
      fullScreen: true,
    }) as Promise<ISignedTxPro>;
  }

  @backgroundMethod()
  async openAddCustomNetworkModal({
    request,
    params,
  }: {
    request: IJsBridgeMessagePayload;
    params: IAddEthereumChainParameter;
  }): Promise<IServerNetwork> {
    return this.openModal({
      request,
      screens: [
        EModalRoutes.DAppConnectionModal,
        EDAppConnectionModal.AddCustomNetworkModal,
      ],
      params: {
        networkInfo: params,
      },
      fullScreen: true,
    }) as Promise<IServerNetwork>;
  }

  @backgroundMethod()
  async openAddCustomTokenModal({
    request,
    ...params
  }: {
    request: IJsBridgeMessagePayload;
    token?: IAccountToken;
    walletId: string;
    isOthersWallet?: boolean;
    indexedAccountId?: string;
    accountId: string;
    networkId: string;
    deriveType: IAccountDeriveTypes;
    onSuccess?: () => void;
  }) {
    return this.openModal({
      request,
      screens: [
        EModalRoutes.DAppConnectionModal,
        EDAppConnectionModal.AddCustomTokenModal,
      ],
      params: {
        ...params,
      },
      fullScreen: true,
    }) as Promise<IServerNetwork>;
  }

  // connection allowance
  @backgroundMethod()
  async getAccountSelectorNum(params: IGetDAppAccountInfoParams) {
    const { storageType, networkImpls } = getQueryDAppAccountParams(params);
    return this.backgroundApi.simpleDb.dappConnection.getAccountSelectorNum(
      params.origin,
      networkImpls,
      storageType,
    );
  }

  @backgroundMethod()
  async deleteExistSessionBeforeConnect({
    origin,
    storageType,
  }: {
    origin: string;
    storageType: IConnectionStorageType;
  }) {
    const rawData =
      await this.backgroundApi.simpleDb.dappConnection.getRawData();
    if (
      storageType === 'walletConnect' &&
      rawData?.data.injectedProvider?.[origin]
    ) {
      await this.disconnectWebsite({
        origin,
        storageType: 'injectedProvider',
        beforeConnect: true,
      });
    } else if (rawData?.data.walletConnect?.[origin]) {
      await this.disconnectWebsite({
        origin,
        storageType: 'walletConnect',
        beforeConnect: true,
      });
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
    storageType: IConnectionStorageType;
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
      imageURL: await serviceDiscovery.buildWebsiteIconUrl(origin, 128),
      storageType,
      walletConnectTopic,
    });
    appEventBus.emit(EAppEventBusNames.DAppConnectUpdate, undefined);
    await this.backgroundApi.serviceSignature.addConnectedSite({
      url: origin,
      items: accountsInfo.map((i) => ({
        networkId: i.networkId ?? '',
        address: i.address,
      })),
    });
  }

  @backgroundMethod()
  async updateConnectionSession(params: {
    origin: string;
    accountSelectorNum: number;
    updatedAccountInfo: IConnectionAccountInfo;
    storageType: IConnectionStorageType;
  }) {
    const { origin, accountSelectorNum, updatedAccountInfo, storageType } =
      params;
    if (storageType === 'walletConnect') {
      await this.updateWalletConnectSession(params);
    }
    await this.backgroundApi.simpleDb.dappConnection.updateConnectionAccountInfo(
      {
        origin,
        accountSelectorNum,
        updatedAccountInfo,
        storageType,
      },
    );
    await this.backgroundApi.serviceSignature.addConnectedSite({
      url: origin,
      items: [
        {
          networkId: updatedAccountInfo.networkId ?? '',
          address: updatedAccountInfo.address,
        },
      ],
    });
  }

  @backgroundMethod()
  async updateWalletConnectSession({
    origin,
    accountSelectorNum,
    updatedAccountInfo,
  }: {
    origin: string;
    accountSelectorNum: number;
    updatedAccountInfo: IConnectionAccountInfo;
    storageType: IConnectionStorageType;
  }) {
    const rawData =
      await this.backgroundApi.simpleDb.dappConnection.getRawData();
    const connectionItem = rawData?.data?.walletConnect?.[origin];
    if (connectionItem && connectionItem.walletConnectTopic) {
      const updatedConnectionMap = {
        ...connectionItem.connectionMap,
        [accountSelectorNum]: updatedAccountInfo,
      };
      console.log('===>updatedConnectionMap: ', updatedConnectionMap);
      await this.backgroundApi.serviceWalletConnect.updateNamespaceAndSession(
        connectionItem.walletConnectTopic,
        Object.values(updatedConnectionMap),
      );
    }
  }

  @backgroundMethod()
  async disconnectWebsite({
    origin,
    storageType,
    beforeConnect = false,
    entry,
  }: {
    origin: string;
    storageType: IConnectionStorageType;
    beforeConnect?: boolean;
    entry?: 'Browser' | 'SettingModal' | 'ExtPanel' | 'ExtFloatingTrigger';
  }) {
    const { simpleDb, serviceWalletConnect } = this.backgroundApi;
    // disconnect walletConnect
    if (storageType === 'walletConnect') {
      const rawData =
        await this.backgroundApi.simpleDb.dappConnection.getRawData();
      const walletConnectTopic =
        rawData?.data?.walletConnect?.[origin].walletConnectTopic;
      if (walletConnectTopic) {
        try {
          await serviceWalletConnect.walletConnectDisconnect(
            walletConnectTopic,
          );
        } catch (e) {
          // ignore error
          console.error('wallet connect disconnect error: ', e);
        }
      }
    }
    await simpleDb.dappConnection.deleteConnection(origin, storageType);
    appEventBus.emit(EAppEventBusNames.DAppConnectUpdate, undefined);
    if (!beforeConnect) {
      await this.backgroundApi.serviceDApp.notifyDAppAccountsChanged(origin);
    }
    if (entry) {
      defaultLogger.discovery.dapp.disconnect({
        dappDomain: origin,
        disconnectType:
          storageType === 'walletConnect' ? 'WalletConnect' : 'Injected',
        disconnectFrom: entry,
      });
    }
  }

  @backgroundMethod()
  async disconnectAllWebsites() {
    await this.backgroundApi.serviceWalletConnect.disconnectAllSessions();
    await this.backgroundApi.simpleDb.dappConnection.clearRawData();
    appEventBus.emit(EAppEventBusNames.DAppConnectUpdate, undefined);
  }

  @backgroundMethod()
  async getConnectedAccountsInfo({
    origin,
    scope,
    isWalletConnectRequest,
    options,
  }: IGetDAppAccountInfoParams) {
    const { storageType, networkImpls } = getQueryDAppAccountParams({
      origin,
      scope,
      isWalletConnectRequest,
      options,
    });
    const allAccountsInfo = [];
    for (const networkImpl of networkImpls) {
      const accountsInfo =
        await this.backgroundApi.simpleDb.dappConnection.findAccountsInfoByOriginAndScope(
          origin,
          storageType,
          networkImpl,
        );
      if (accountsInfo) {
        allAccountsInfo.push(...accountsInfo);
      }
    }
    if (!allAccountsInfo.length) {
      return null;
    }

    return allAccountsInfo;
  }

  @backgroundMethod()
  async getConnectedAccounts(params: IGetDAppAccountInfoParams) {
    const accountsInfo = await this.getConnectedAccountsInfo(params);
    if (!accountsInfo) return null;
    const result = await Promise.all(
      accountsInfo.map(async (accountInfo) => {
        const { accountId, networkId } = accountInfo;
        try {
          const account = await this.backgroundApi.serviceAccount.getAccount({
            accountId,
            networkId: networkId || '',
          });
          return {
            account,
            accountInfo,
          };
        } catch (e) {
          console.error('getConnectedAccounts', e);
          return null;
        }
      }),
    );
    const finalAccountsInfo = result.filter(Boolean);
    if (finalAccountsInfo.length !== accountsInfo.length) {
      console.log('getConnectedAccounts: ===> some accounts not found');
      return null;
    }
    return finalAccountsInfo;
  }

  @backgroundMethod()
  async dAppGetConnectedAccountsInfo(
    request: IJsBridgeMessagePayload,
  ): Promise<IConnectedAccountInfo[] | null> {
    if (!request.origin) {
      throw web3Errors.provider.unauthorized('origin is required');
    }
    const accountsInfo = await this.getConnectedAccounts({
      origin: request.origin ?? '',
      scope: request.scope,
      isWalletConnectRequest: request.isWalletConnectRequest,
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
  async findInjectedAccountByOrigin(origin: string) {
    const result =
      await this.backgroundApi.simpleDb.dappConnection.findInjectedAccountsInfoByOrigin(
        origin,
      );
    if (!result) {
      return null;
    }
    return Promise.all(
      result.map(async (accountInfo) => {
        const impls = networkUtils.isBTCNetwork(accountInfo.networkId)
          ? [IMPL_BTC, IMPL_TBTC]
          : [accountInfo.networkImpl];
        const { networkIds } =
          await this.backgroundApi.serviceNetwork.getNetworkIdsByImpls({
            impls,
          });
        return { ...accountInfo, availableNetworkIds: networkIds };
      }),
    );
  }

  @backgroundMethod()
  async getAllConnectedList(): Promise<IConnectionItemWithStorageType[]> {
    const { simpleDb, serviceWalletConnect } = this.backgroundApi;
    const rawData = await simpleDb.dappConnection.getRawData();
    const injectedProviders: IConnectionItemWithStorageType[] = rawData?.data
      ?.injectedProvider
      ? Object.values(rawData.data.injectedProvider).map((i) => ({
          ...i,
          storageType: 'injectedProvider',
        }))
      : [];

    const activeSessions = await serviceWalletConnect.getActiveSessions();
    const activeSessionTopics = new Set(Object.keys(activeSessions ?? {}));

    let walletConnects: IConnectionItemWithStorageType[] = [];
    if (rawData?.data?.walletConnect) {
      await this.disconnectInactiveSessions(
        rawData.data.walletConnect,
        activeSessionTopics,
      );
      // Re-filter walletConnects to only retain active sessions
      walletConnects = Object.entries(rawData.data.walletConnect)
        .filter(([, value]) =>
          activeSessionTopics.has(value.walletConnectTopic ?? ''),
        )
        .map(([, value]) => ({ ...value, storageType: 'walletConnect' }));
    }

    // Combine all connected lists and build availableNetworksMap
    const allConnectedList = [...injectedProviders, ...walletConnects];
    for (const item of allConnectedList) {
      const networksMap: Record<string, { networkIds: string[] }> = {};
      for (const [num, accountInfo] of Object.entries(item.connectionMap)) {
        // build walletconnect networkIds
        if (item.walletConnectTopic) {
          const namespace =
            implToNamespaceMap[
              accountInfo.networkImpl as keyof typeof implToNamespaceMap
            ];
          const namespaces = activeSessions?.[item.walletConnectTopic ?? ''];
          if (namespaces) {
            const { requiredNamespaces, optionalNamespaces } = namespaces;
            const networkIds =
              await this.backgroundApi.serviceWalletConnect.getAvailableNetworkIdsForNamespace(
                requiredNamespaces,
                optionalNamespaces,
                namespace,
              );
            networksMap[num] = { networkIds };
          }
        } else {
          // build injected provider networkIds
          const { networkIds } =
            await this.backgroundApi.serviceNetwork.getNetworkIdsByImpls({
              impls: [accountInfo.networkImpl],
            });
          networksMap[num] = { networkIds };
        }
      }
      item.availableNetworksMap = networksMap;
    }
    const sortedList = allConnectedList.sort((a, b) => {
      const aTime = a.updatedAt ?? 0;
      const bTime = b.updatedAt ?? 0;
      return bTime - aTime;
    });
    return sortedList;
  }

  async disconnectInactiveSessions(
    walletConnectData: Record<string, IConnectionItem>,
    activeSessionTopics: Set<string>,
  ) {
    const disconnectPromises = Object.entries(walletConnectData)
      .filter(
        ([, value]) =>
          value.walletConnectTopic &&
          !activeSessionTopics.has(value.walletConnectTopic),
      )
      .map(([key]) =>
        this.disconnectWebsite({
          origin: key,
          storageType: 'walletConnect',
        }).catch((error) =>
          console.error(`Failed to disconnect ${key}:`, error),
        ),
      );

    try {
      await Promise.all(disconnectPromises);
    } catch {
      // Errors have been individually handled in each disconnect operation, no further action is required here.
    }
  }

  @backgroundMethod()
  async getConnectedNetworks(request: IJsBridgeMessagePayload) {
    const accountsInfo = await this.getConnectedAccountsInfo({
      origin: request.origin ?? '',
      scope: request.scope,
      isWalletConnectRequest: request.isWalletConnectRequest,
    });
    if (!accountsInfo) {
      console.log('getConnectedNetworks: ===> Network not found');
      return [];
    }
    const networkIds = accountsInfo.map(
      (accountInfo) => accountInfo.networkId || '',
    );
    const { networks } =
      await this.backgroundApi.serviceNetwork.getNetworksByIds({ networkIds });
    return networks;
  }

  @backgroundMethod()
  async switchConnectedNetwork(
    params: IGetDAppAccountInfoParams & {
      oldNetworkId?: string;
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
    const { shouldSwitchNetwork, isDifferentNetworkImpl } =
      await this.getSwitchNetworkInfo(params);
    if (!shouldSwitchNetwork) {
      return;
    }

    const { storageType, networkImpls } = getQueryDAppAccountParams(params);
    const accountSelectorNum =
      await this.backgroundApi.simpleDb.dappConnection.getAccountSelectorNum(
        params.origin,
        networkImpls,
        storageType,
      );
    console.log('====> accountSelectorNum: ', accountSelectorNum);
    const map =
      await this.backgroundApi.simpleDb.dappConnection.getAccountSelectorMap({
        sceneUrl: params.origin,
      });
    const existSelectedAccount = map?.[accountSelectorNum];
    let updatedAccountInfo: IConnectionAccountInfo | null = null;
    if (existSelectedAccount) {
      const { selectedAccount, activeAccount } =
        await this.backgroundApi.serviceAccountSelector.buildActiveAccountInfoFromSelectedAccount(
          {
            selectedAccount: {
              ...existSelectedAccount,
              networkId: newNetworkId,
            },
          },
        );

      if (!activeAccount.account) {
        throw new Error('Switch network failed, account not found');
      }

      updatedAccountInfo = {
        ...selectedAccount,
        accountId: activeAccount?.account.id,
        address: activeAccount?.account.address,
        networkImpl: activeAccount?.account.impl,
      };
    }
    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId: newNetworkId,
    });
    // update account info if network impl is different, tbtc !== btc
    if (isDifferentNetworkImpl && updatedAccountInfo) {
      await this.backgroundApi.simpleDb.dappConnection.updateConnectionAccountInfo(
        {
          origin: params.origin,
          accountSelectorNum,
          updatedAccountInfo,
          storageType,
        },
      );
    } else {
      await this.backgroundApi.simpleDb.dappConnection.updateNetworkId(
        params.origin,
        network.impl,
        newNetworkId,
        storageType,
      );
    }

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
  async getSwitchNetworkInfo(
    params: IGetDAppAccountInfoParams & {
      newNetworkId: string;
      oldNetworkId?: string;
    },
  ) {
    const { newNetworkId, oldNetworkId } = params;
    const accountsInfo = await this.getConnectedAccountsInfo(params);
    let shouldSwitchNetwork = false;
    let isDifferentNetworkImpl = false;
    if (
      !accountsInfo ||
      (Array.isArray(accountsInfo) && !accountsInfo.length)
    ) {
      return {
        shouldSwitchNetwork,
        isDifferentNetworkImpl,
      };
    }
    const newNetwork = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId: newNetworkId,
    });
    for (const accountInfo of accountsInfo) {
      if (oldNetworkId) {
        // tbtc !== btc
        if (oldNetworkId === accountInfo.networkId) {
          shouldSwitchNetwork = accountInfo.networkId !== newNetworkId;
          isDifferentNetworkImpl = accountInfo.networkImpl !== newNetwork.impl;
        }
      } else if (accountInfo.networkId !== newNetworkId) {
        shouldSwitchNetwork = true;
      }
    }
    return {
      shouldSwitchNetwork,
      isDifferentNetworkImpl,
    };
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

  @backgroundMethod()
  async removeDappConnectionAfterWalletRemove(params: { walletId: string }) {
    return this.backgroundApi.simpleDb.dappConnection.removeWallet(params);
  }

  @backgroundMethod()
  async removeDappConnectionAfterAccountRemove(params: {
    accountId?: string;
    indexedAccountId?: string;
  }) {
    return this.backgroundApi.simpleDb.dappConnection.removeAccount(params);
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
        try {
          provider.notifyDappChainChanged({
            send: this.backgroundApi.sendForProvider(provider.providerName),
            targetOrigin,
          });
        } catch {
          // ignore error
        }
      },
    );
    return Promise.resolve();
  }

  @backgroundMethod()
  async notifyChainSwitchUIToDappSite(params: {
    targetOrigin: string;
    getNetworkName: ({ origin }: { origin: string }) => Promise<string>;
  }) {
    const privateProvider = this.backgroundApi.providers
      .$private as ProviderApiPrivate;
    void privateProvider.notifyDappSiteOfNetworkChange(
      {
        send: this.backgroundApi.sendForProvider('$private'),
        targetOrigin: params.targetOrigin,
      },
      {
        getNetworkName: params.getNetworkName,
      },
    );
  }

  // Follow home account changed to switch dApp connection account
  @backgroundMethod()
  async isSupportSwitchDAppConnectionAccount(params: {
    origin: string;
    accountId?: string;
    networkId?: string;
    indexedAccountId?: string;
    isOthersWallet?: boolean;
    deriveType: IAccountDeriveTypes;
  }) {
    const {
      origin,
      accountId,
      indexedAccountId,
      networkId,
      isOthersWallet,
      deriveType,
    } = params;
    const connectedAccountsInfo = await this.findInjectedAccountByOrigin(
      origin,
    );
    if (
      !connectedAccountsInfo ||
      !connectedAccountsInfo.length ||
      connectedAccountsInfo.length > 1
    ) {
      return { supportSwitchConnectionAccount: false, accountExist: false };
    }

    const connectedAccountInfo = connectedAccountsInfo[0];
    if (accountId && connectedAccountInfo.accountId === accountId) {
      return { supportSwitchConnectionAccount: false, accountExist: true };
    }
    const connectedAccount = await this.backgroundApi.serviceAccount.getAccount(
      {
        accountId: connectedAccountInfo.accountId,
        networkId: connectedAccountInfo.networkId ?? '',
      },
    );
    if (isOthersWallet && accountId && networkId) {
      const otherAccount = await this.backgroundApi.serviceAccount.getAccount({
        accountId,
        networkId,
      });
      // If networkId is same or both are evm, support switch
      if (
        (connectedAccount.impl === IMPL_EVM &&
          otherAccount.impl === IMPL_EVM) ||
        connectedAccountInfo.networkId === networkId
      ) {
        return { supportSwitchConnectionAccount: true, accountExist: true };
      }

      return { supportSwitchConnectionAccount: false, accountExist: true };
    }
    if (!indexedAccountId) {
      return { supportSwitchConnectionAccount: false, accountExist: false };
    }

    try {
      const usedDeriveType = networkUtils.isBTCNetwork(
        connectedAccountInfo.networkId,
      )
        ? connectedAccountInfo.deriveType
        : deriveType;
      const networkAccount =
        await this.backgroundApi.serviceAccount.getNetworkAccount({
          accountId: undefined,
          indexedAccountId,
          networkId: connectedAccountInfo.networkId ?? '',
          deriveType: usedDeriveType,
        });

      if (connectedAccount.id === networkAccount?.id) {
        return {
          supportSwitchConnectionAccount: false,
          accountExist: !!networkAccount?.id,
        };
      }
      return {
        supportSwitchConnectionAccount: true,
        accountExist: !!networkAccount?.id,
      };
    } catch {
      return { supportSwitchConnectionAccount: true, accountExist: false };
    }
  }

  @backgroundMethod()
  async getDappConnectNetworkAccount(params: {
    origin: string;
    accountId?: string;
    networkId?: string;
    indexedAccountId?: string;
    isOthersWallet?: boolean;
    deriveType: IAccountDeriveTypes;
  }) {
    const {
      origin,
      accountId,
      indexedAccountId,
      networkId,
      isOthersWallet,
      deriveType,
    } = params;
    const connectedAccountsInfo = await this.findInjectedAccountByOrigin(
      origin,
    );
    if (
      !connectedAccountsInfo ||
      !connectedAccountsInfo.length ||
      connectedAccountsInfo.length > 1
    ) {
      return null;
    }

    const connectedAccountInfo = connectedAccountsInfo[0];
    if (isOthersWallet && accountId && networkId) {
      try {
        const otherAccount = await this.backgroundApi.serviceAccount.getAccount(
          {
            accountId,
            networkId,
          },
        );
        return otherAccount;
      } catch {
        return null;
      }
    }

    if (!indexedAccountId) {
      return null;
    }

    try {
      const usedDeriveType = networkUtils.isBTCNetwork(
        connectedAccountInfo.networkId,
      )
        ? connectedAccountInfo.deriveType
        : deriveType;
      const networkAccount =
        await this.backgroundApi.serviceAccount.getNetworkAccount({
          accountId: undefined,
          indexedAccountId,
          networkId: connectedAccountInfo.networkId ?? '',
          deriveType: usedDeriveType,
        });
      return networkAccount;
    } catch {
      return null;
    }
  }

  @backgroundMethod()
  async proxyRPCCall<T>({
    networkId,
    request,
    skipParseResponse,
    origin,
  }: {
    networkId: string;
    request: IJsonRpcRequest;
    skipParseResponse?: boolean;
    origin: string;
  }) {
    const isCustomNetwork =
      await this.backgroundApi.serviceNetwork.isCustomNetwork({
        networkId,
      });
    if (isCustomNetwork) {
      const vault = await vaultFactory.getChainOnlyVault({
        networkId,
      });
      const result = await vault.proxyJsonRPCCall(request);
      return [result];
    }
    const client = await this.getClient(EServiceEndpointEnum.Wallet);
    const results = await client.post<{
      data: {
        data: {
          id: number | string;
          jsonrpc: string;
          result: T;
        }[];
      };
    }>('/wallet/v1/proxy/network', {
      networkId,
      body: [
        {
          route: 'rpc',
          params: request.id ? request : { ...request, id: 0 },
        },
      ],
      origin,
    });

    const data = results.data.data.data;

    return data.map((item) =>
      skipParseResponse ? item : parseRPCResponse(item),
    );
  }

  @backgroundMethod()
  isWebEmbedApiReady() {
    const privateProvider = this.backgroundApi.providers.$private as
      | ProviderApiPrivate
      | undefined;
    return Promise.resolve(privateProvider?.isWebEmbedApiReady);
  }

  @backgroundMethod()
  callWebEmbedApiProxy(data: IBackgroundApiWebembedCallMessage) {
    const privateProvider = this.backgroundApi.providers.$private as
      | ProviderApiPrivate
      | undefined;
    return privateProvider?.callWebEmbedApiProxy(data);
  }

  @backgroundMethod()
  async getLastFocusUrl() {
    const privateProvider = this.backgroundApi.providers.$private as
      | ProviderApiPrivate
      | undefined;
    return privateProvider?.getLastFocusUrl();
  }
}

export default ServiceDApp;
