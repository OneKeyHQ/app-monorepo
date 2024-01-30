import { getSdkError } from '@walletconnect/utils';
import { debounce } from 'lodash';

import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ERootRoutes } from '@onekeyhq/kit/src/routes/enum';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
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
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
import type {
  IConnectionAccountInfo,
  IGetDAppAccountInfoParams,
  IStorageType,
} from '@onekeyhq/shared/types/dappConnection';

import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type ProviderApiBase from '../providers/ProviderApiBase';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';
import type { SessionTypes } from '@walletconnect/types';

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
    console.log('sampleMethod');
    return new Promise((resolve, reject) => {
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
        origin: request.origin || '',
        hostname: uriUtils.getHostNameFromUrl({ url: request.origin || '' }),
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

  @backgroundMethod()
  async getWalletConnectActiveSessions() {
    await this.backgroundApi.walletConnect.initialize();
    return this.backgroundApi.walletConnect.web3Wallet?.getActiveSessions();
  }

  @backgroundMethod()
  async walletConnectDisconnect(topic: string) {
    return this.backgroundApi.walletConnect.web3Wallet?.disconnectSession({
      topic,
      reason: getSdkError('USER_DISCONNECTED'),
    });
  }

  @backgroundMethod()
  async updateWalletConnectSession(
    topic: string,
    namespaces: SessionTypes.Namespaces,
  ) {
    return this.backgroundApi.walletConnect.web3Wallet?.updateSession({
      topic,
      namespaces,
    });
  }

  @backgroundMethod()
  async signMessage({
    unsignedMessage,
    networkId,
    accountId,
  }: {
    unsignedMessage?: IUnsignedMessage;
    networkId: string;
    accountId: string;
  }) {
    const vault = await vaultFactory.getVault({
      networkId,
      accountId,
    });

    let validUnsignedMessage = unsignedMessage;
    if (unsignedMessage) {
      validUnsignedMessage = getValidUnsignedMessage(unsignedMessage);
    }

    if (!validUnsignedMessage) {
      throw new Error('Invalid unsigned message');
    }

    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify();
    const [signedMessage] = await vault.keyring.signMessage({
      messages: [validUnsignedMessage],
      password,
    });

    return signedMessage;
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
  async saveConnectionSession({
    origin,
    accountsInfo,
    storageType,
  }: {
    origin: string;
    accountsInfo: IConnectionAccountInfo[];
    storageType: IStorageType;
  }) {
    await this.backgroundApi.simpleDb.dappConnection.upsertConnection({
      origin,
      accountsInfo,
      imageURL: await this.backgroundApi.serviceDiscovery.getWebsiteIcon(
        origin,
        128,
      ),
      storageType,
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
    return this.backgroundApi.simpleDb.dappConnection.deleteConnection(
      origin,
      storageType,
    );
  }

  @backgroundMethod()
  async disconnectAllWebsites() {
    return this.backgroundApi.simpleDb.dappConnection.clearRawData();
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
  async getAllConnectedAccountsByOrigin(origin: string) {
    return this.backgroundApi.simpleDb.dappConnection.findAccountsInfoByOrigin(
      origin,
    );
  }

  @backgroundMethod()
  async getAllConnectedList() {
    const rawData =
      await this.backgroundApi.simpleDb.dappConnection.getRawData();
    if (!rawData || !rawData.data || !rawData.data.injectedProvider) {
      return [];
    }
    return Object.values(rawData.data.injectedProvider);
  }

  @backgroundMethod()
  async getConnectedNetworks(params: IGetDAppAccountInfoParams) {
    const accountsInfo = await this.getConnectedAccountsInfo(params);
    if (!accountsInfo) return null;
    const networkIds = accountsInfo.map((accountInfo) => accountInfo.networkId);
    const { networks } =
      await this.backgroundApi.serviceNetwork.getNetworksByIds({ networkIds });
    return networks;
  }

  @backgroundMethod()
  async switchConnectedNetwork({
    newNetworkId,
    ...params
  }: IGetDAppAccountInfoParams & {
    newNetworkId: string;
  }) {
    const { networkIds } =
      await this.backgroundApi.serviceNetwork.getAllNetworkIds();
    const included = networkIds.some((networkId) => networkId === newNetworkId);
    if (!included) {
      return;
    }
    const { storageType, networkImpl } = getQueryDAppAccountParams(params);
    // TODO: buildActiveAccount, upsert accountselector simpledb, emit event bus
    await this.backgroundApi.simpleDb.dappConnection.updateNetworkId(
      params.origin,
      networkImpl,
      newNetworkId,
      storageType,
    );
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
