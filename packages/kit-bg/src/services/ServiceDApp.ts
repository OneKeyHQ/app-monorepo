import { getSdkError } from '@walletconnect/utils';
import { debounce, get } from 'lodash';

import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ERootRoutes } from '@onekeyhq/kit/src/routes/enum';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EDAppConnectionModal } from '@onekeyhq/kit/src/views/DAppConnection/router';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkImplFromDappScope } from '@onekeyhq/shared/src/background/backgroundUtils';
import { serverPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ensureSerializable } from '@onekeyhq/shared/src/utils/assertUtils';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { getValidUnsignedMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IDappSourceInfo, IServerNetwork } from '@onekeyhq/shared/types';
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
  const { scope, options = {} } = params;

  const isWalletConnect = scope === 'walletconnect';
  const storageType: IStorageType = isWalletConnect
    ? 'walletConnect'
    : 'injectedProvider';
  let networkImpl: string | undefined = '';
  if (isWalletConnect) {
    networkImpl = options.networkImpl;
  } else {
    networkImpl = getNetworkImplFromDappScope(scope);
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
  }: {
    request: IJsBridgeMessagePayload;
    screens: any[];
    params?: any;
  }) {
    console.log('sampleMethod');
    return new Promise((resolve, reject) => {
      const id = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      const modalScreens = screens;
      const routeNames = [ERootRoutes.Modal, ...modalScreens];
      const $sourceInfo: IDappSourceInfo = {
        id,
        origin: request.origin || '',
        hostname: uriUtils.getHostNameFromUrl({ url: request.origin || '' }),
        scope: request.scope as any,
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
      screens: [EModalRoutes.WalletConnectModal, 'SignMessageModal'],
      params: {
        unsignedMessage,
        accountId,
        networkId,
      },
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
  async getAccountSelectorNum({ origin, scope }: IGetDAppAccountInfoParams) {
    const { storageType, networkImpl } = getQueryDAppAccountParams({
      origin,
      scope,
    });
    return this.backgroundApi.simpleDb.dappConnection.getAccountSelectorNum(
      origin,
      networkImpl,
      storageType,
    );
  }

  @backgroundMethod()
  async saveConnectionSession({
    origin,
    accountInfos,
    storageType,
  }: {
    origin: string;
    accountInfos: IConnectionAccountInfo[];
    storageType: IStorageType;
  }) {
    await this.backgroundApi.simpleDb.dappConnection.upsertConnection({
      origin,
      accountInfos,
      imageURL: await this.backgroundApi.serviceDiscovery.getWebsiteIcon(
        origin,
        128,
      ),
      storageType,
    });
  }

  @backgroundMethod()
  async disconnectAccount({
    origin,
    scope,
    num,
  }: IGetDAppAccountInfoParams & { num: number }) {
    const { storageType } = getQueryDAppAccountParams({
      origin,
      scope,
    });
    await this.backgroundApi.simpleDb.dappConnection.deleteConnection(
      origin,
      storageType,
      num,
    );
  }

  async getConnectedAccountsInfo({ origin, scope }: IGetDAppAccountInfoParams) {
    const { storageType, networkImpl } = getQueryDAppAccountParams({
      origin,
      scope,
    });
    const accountsInfo =
      await this.backgroundApi.simpleDb.dappConnection.findAccountInfosByOriginAndScope(
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
  async getConnectedAccounts({ origin, scope }: IGetDAppAccountInfoParams) {
    const accountsInfo = await this.getConnectedAccountsInfo({ origin, scope });
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
  async getConnectedNetworks({ origin, scope }: IGetDAppAccountInfoParams) {
    const accountsInfo = await this.getConnectedAccountsInfo({ origin, scope });
    if (!accountsInfo) return null;
    const networks = accountsInfo
      .map((accountInfo) =>
        serverPresetNetworks.find((i) => i.id === accountInfo.networkId),
      )
      .filter(Boolean);

    return Promise.resolve(networks as IServerNetwork[]);
  }

  @backgroundMethod()
  async switchConnectedNetwork({
    origin,
    scope,
    newNetworkId,
  }: IGetDAppAccountInfoParams & {
    newNetworkId: string;
  }) {
    const networks = await this.backgroundApi.serviceDApp.fetchNetworks();
    const included = networks.some((network) => network.id === newNetworkId);
    if (!included) {
      return;
    }
    const { storageType, networkImpl } = getQueryDAppAccountParams({
      origin,
      scope,
    });
    await this.backgroundApi.simpleDb.dappConnection.updateNetworkId(
      origin,
      networkImpl,
      newNetworkId,
      storageType,
    );
  }

  @backgroundMethod()
  async fetchNetworks() {
    return Promise.resolve(serverPresetNetworks);
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
