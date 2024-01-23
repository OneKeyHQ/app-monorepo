import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { cloneDeep, debounce } from 'lodash';

import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';
import type {
  Account,
  DBVariantAccount,
} from '@onekeyhq/engine/src/types/account';
import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks';
import { buildModalRouteParams } from '@onekeyhq/kit/src/hooks/useAutoNavigateOnMount';
import type {
  IDappConnectionParams,
  IDappInscribeTransferParams,
  IDappSignAndSendParams,
} from '@onekeyhq/kit/src/hooks/useDappParams';
import {
  DappConnectionModalRoutes,
  InscribeModalRoutes,
  ManageNetworkModalRoutes,
  ManageTokenModalRoutes,
  ModalRoutes,
  RootRoutes,
  SendModalRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type {
  DappSiteConnection,
  DappSiteConnectionRemovePayload,
  DappSiteConnectionSavePayload,
} from '@onekeyhq/kit/src/store/reducers/dapp';
import {
  dappRemoveSiteConnections,
  dappSaveSiteConnection,
  dappUpdateSiteConnectionAddress,
} from '@onekeyhq/kit/src/store/reducers/dapp';
import extUtils from '@onekeyhq/kit/src/utils/extUtils';
import { getTimeDurationMs, wait } from '@onekeyhq/kit/src/utils/helper';
import { isSendModalRouteExisting } from '@onekeyhq/kit/src/utils/routeUtils';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  ensureSerializable,
  getNetworkImplFromDappScope,
  isDappScopeMatchNetwork,
  waitForDataLoaded,
} from '@onekeyhq/shared/src/background/backgroundUtils';
import {
  IMPL_BTC,
  IMPL_COSMOS,
  IMPL_SOL,
  IMPL_TBTC,
  SEPERATOR,
  isLightningNetwork,
} from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import urlUtils from '@onekeyhq/shared/src/utils/urlUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';

import ServiceBase from './ServiceBase';

import type {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import type { SessionTypes } from '@walletconnect-v2/types';

type CommonRequestParams = {
  request: IJsBridgeMessagePayload;
};

@backgroundClass()
class ServiceDapp extends ServiceBase {
  isSendConfirmModalVisible = false;

  // TODO remove after dapp request queue implemented.
  @backgroundMethod()
  setSendConfirmModalVisible({ visible }: { visible: boolean }) {
    this.isSendConfirmModalVisible = visible;
  }

  async processBatchTransactionOneByOne({ run }: { run: () => Promise<void> }) {
    this.isSendConfirmModalVisible = true;

    await run();

    // set isSendConfirmModalVisible=false in SendFeedbackReceipt.tsx
    await waitForDataLoaded({
      data: () => !this.isSendConfirmModalVisible,
      timeout: getTimeDurationMs({ minute: 1 }),
      logName: 'processBatchTransactionOneByOne wait isSendConfirmModalVisible',
    });
    await wait(1000);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  @backgroundMethod()
  async getActiveConnectedAccountsAsync({
    origin,
    impl,
  }: {
    origin: string;
    impl: string;
  }) {
    return this.getActiveConnectedAccounts({ origin, impl });
  }

  // TODO add IInjectedProviderNames or scope
  getActiveConnectedAccounts({
    origin,
    impl,
  }: {
    origin: string;
    impl: string;
  }): DappSiteConnection[] {
    const { appSelector } = this.backgroundApi;
    const {
      accountAddress: activeAccountAddress,
      accountId,
      account,
    } = getActiveWalletAccount();
    const accountAddress = this.getAccountAddress({
      accountAddress: activeAccountAddress,
      account,
    });
    const connections: DappSiteConnection[] = appSelector(
      (s) => s.dapp.connections,
    );
    const { isUnlock } = appSelector((s) => s.status);
    if (!isUnlock) {
      // TODO unlock status check
      //   return [];
    }
    if (!origin) {
      return [];
    }
    const accounts = connections
      .filter(
        (item) => {
          try {
            return (
              // only match hostname
              new URL(item.site.origin).hostname === new URL(origin).hostname &&
              item.networkImpl === impl
            );
          } catch {
            return false;
          }
        },
        // && item.address === accountAddress, // only match current active account
      )
      .filter((item) => item.address && item.networkImpl);

    if (accounts.length) {
      const list = cloneDeep(accounts);
      const actionsToUpdate: any[] = [];
      // support all accounts for dapp connection, do NOT need approval again
      list.forEach((item) => {
        if (
          isAccountCompatibleWithNetwork(
            accountId,
            `${item.networkImpl}${SEPERATOR}1`,
          )
        ) {
          if (impl !== IMPL_COSMOS) {
            if (item.address !== accountAddress) {
              item.address = accountAddress;
              actionsToUpdate.push(dappUpdateSiteConnectionAddress(item));
            }
          }
        }
      });
      if (actionsToUpdate.length) {
        setTimeout(() => {
          this.backgroundApi.dispatch(...actionsToUpdate);
        }, 800);
      }
      return list;
    }
    return accounts;
  }

  getAccountAddress({
    accountAddress,
    account,
  }: {
    accountAddress: string;
    account: Account | null | undefined;
  }) {
    if (!account) return '';
    if (isLightningNetwork(account.coinType)) {
      const addresses: DBVariantAccount['addresses'] =
        account.addresses && !!account.addresses.length
          ? JSON.parse(account.addresses)
          : {};
      return addresses?.hashAddress || '';
    }
    return accountAddress;
  }

  @backgroundMethod()
  async saveConnectedAccounts(payload: DappSiteConnectionSavePayload) {
    if (!payload?.site?.origin) {
      throw new Error('saveConnectedAccounts ERROR: origin is empty');
    }
    this.backgroundApi.dispatch(dappSaveSiteConnection(payload));
    return Promise.resolve();
  }

  @backgroundMethod()
  removeConnectedAccounts(payload: DappSiteConnectionRemovePayload) {
    this.backgroundApi.dispatch(dappRemoveSiteConnections(payload));
    setTimeout(() => {
      this.backgroundApi.serviceAccount.notifyAccountsChanged();
    }, 1500);
  }

  @backgroundMethod()
  async cancelConnectedSite(payload: DappSiteConnection): Promise<void> {
    // check walletConnect
    if (
      this.backgroundApi.walletConnect.connector &&
      this.backgroundApi.walletConnect.connector.peerMeta?.url ===
        payload.site.origin
    ) {
      // disconnect WalletConnect V1 session
      this.backgroundApi.walletConnect.disconnect();
    }
    this.removeConnectedAccounts({
      origin: payload.site.origin,
      networkImpl: payload.networkImpl,
      addresses: [payload.address],
    });
    await this.backgroundApi.serviceAccount.notifyAccountsChanged();
  }

  @backgroundMethod()
  async getWalletConnectSession() {
    if (this.backgroundApi.walletConnect.connector) {
      const { session } = this.backgroundApi.walletConnect.connector;
      return Promise.resolve(
        this.backgroundApi.walletConnect.connector.connected ? session : null,
      );
    }
  }

  @backgroundMethod()
  async getWalletConnectSessionV2(): Promise<{
    sessions: SessionTypes.Struct[];
  }> {
    let sessions: SessionTypes.Struct[] = [];
    if (this?.backgroundApi?.walletConnect?.web3walletV2) {
      const res = await this.backgroundApi.walletConnect.getActiveSessionsV2();
      sessions = res.sessions ?? [];
    }
    return Promise.resolve({
      sessions,
    });
  }

  // TODO to decorator @permissionRequired()
  authorizedRequired(request: IJsBridgeMessagePayload) {
    if (!this.isDappAuthorized(request)) {
      throw web3Errors.provider.unauthorized();
    }
  }

  isDappAuthorized(request: IJsBridgeMessagePayload) {
    if (!request.scope) {
      return false;
    }
    if (!request.origin) {
      return false;
    }
    const impl = getNetworkImplFromDappScope(request.scope);
    if (!impl) {
      return false;
    }
    const accounts = this.backgroundApi.serviceDapp?.getActiveConnectedAccounts(
      {
        origin: request.origin,
        impl,
      },
    );
    return Boolean(accounts && accounts.length);
  }

  @backgroundMethod()
  async openConnectionModal(
    request: CommonRequestParams['request'],
    params?: IDappConnectionParams,
  ) {
    const result = await this.openModal({
      request,
      screens: [
        ModalRoutes.DappConnectionModal,
        DappConnectionModalRoutes.ConnectionModal,
      ],
      params,
    });
    await wait(200);
    this.backgroundApi.serviceAccount.notifyAccountsChanged();
    await wait(200);
    return result;
  }

  // TODO support dapp accountId & networkId
  openSignAndSendModal(
    request: IJsBridgeMessagePayload,
    params: IDappSignAndSendParams,
  ) {
    // Move authorizedRequired to UI check
    // this.authorizedRequired(request);

    return this.openModal({
      request,
      screens: [ModalRoutes.Send, SendModalRoutes.SendConfirmFromDapp],
      params,
      isAuthorizedRequired: true,
    });
  }

  openAddTokenModal(request: IJsBridgeMessagePayload, params: any) {
    return this.openModal({
      request,
      screens: [ModalRoutes.ManageToken, ManageTokenModalRoutes.AddToken],
      params,
    });
  }

  openAddNetworkModal(request: IJsBridgeMessagePayload, params: any) {
    return this.openModal({
      request,
      screens: [
        ModalRoutes.ManageNetwork,
        ManageNetworkModalRoutes.AddNetworkConfirm,
      ],
      params,
    });
  }

  openSwitchNetworkModal(request: IJsBridgeMessagePayload, params: any) {
    return this.openModal({
      request,
      screens: [
        ModalRoutes.ManageNetwork,
        ManageNetworkModalRoutes.SwitchNetwork,
      ],
      params,
    });
  }

  openInscribeTransferModal(
    request: IJsBridgeMessagePayload,
    params: IDappInscribeTransferParams,
  ) {
    return this.openModal({
      request,
      screens: [
        ModalRoutes.Inscribe,
        InscribeModalRoutes.InscribeTransferFromDapp,
      ],
      params,
      isAuthorizedRequired: true,
    });
  }

  openSwitchRpcModal(request: IJsBridgeMessagePayload, params: any) {
    return this.openModal({
      request,
      screens: [ModalRoutes.ManageNetwork, ManageNetworkModalRoutes.SwitchRpc],
      params,
    });
  }

  isSendModalExisting() {
    return isSendModalRouteExisting();
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
      extUtils.openStandaloneWindow({
        routes: routeNames,
        params: routeParams,
      });
    } else {
      const doOpenModal = () =>
        global.$navigationRef.current?.navigate(
          modalParams.screen,
          modalParams.params,
        );
      // TODO remove timeout after dapp request queue implemented.
      setTimeout(() => doOpenModal(), this.isSendModalExisting() ? 1000 : 0);
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

  async openModal({
    request,
    screens = [],
    params = {},
    isAuthorizedRequired,
  }: {
    request: IJsBridgeMessagePayload;
    screens: any[];
    params?: any;
    isAuthorizedRequired?: boolean;
  }) {
    const { network } = getActiveWalletAccount();
    const isNotAuthorized = !this.isDappAuthorized(request);
    let isNotMatchedNetwork = !isDappScopeMatchNetwork(
      request.scope,
      network?.impl === IMPL_TBTC ? IMPL_BTC : network?.impl,
    );
    let shouldShowNotMatchedNetworkModal = true;
    const requestMethod = (request.data as IJsonRpcRequest)?.method || '';
    const notMatchedErrorMessage = `OneKey Wallet chain/network not matched. method=${requestMethod} scope=${
      request.scope || ''
    } origin=${request.origin || ''}`;

    if (isAuthorizedRequired && isNotAuthorized) {
      // TODO show different modal for isNotAuthorized
      isNotMatchedNetwork = true;
    }

    if (
      isNotMatchedNetwork &&
      request.origin === 'https://opensea.io' &&
      request.scope === 'solana' &&
      network?.impl !== IMPL_SOL
    ) {
      shouldShowNotMatchedNetworkModal = false;
    }

    if (isNotMatchedNetwork && request.scope === 'nostr') {
      isNotMatchedNetwork = false;
    }

    return new Promise((resolve, reject) => {
      const id = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      let modalScreens = screens;
      // TODO not matched network modal should be singleton and debounced
      if (isNotMatchedNetwork) {
        modalScreens = [
          ModalRoutes.DappConnectionModal,
          DappConnectionModalRoutes.NetworkNotMatchModal,
        ];
      }
      const routeNames = [RootRoutes.Modal, ...modalScreens];

      const sourceInfo: IDappSourceInfo = {
        id,
        origin: request.origin || '',
        hostname: urlUtils.getHostNameFromUrl({ url: request.origin || '' }),
        scope: request.scope as any, // ethereum
        data: request.data as any,
      };
      const routeParams = {
        // stringify required, nested object not working with Ext route linking
        query: JSON.stringify(
          {
            sourceInfo, // TODO rename $sourceInfo
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

      if (isNotMatchedNetwork) {
        if (shouldShowNotMatchedNetworkModal) {
          this._openModalByRouteParamsDebounced({
            routeNames,
            routeParams,
            modalParams,
          });
        }

        if (requestMethod === 'eth_requestAccounts') {
          // some dapps like https://polymm.finance/ will call `eth_requestAccounts` infinitely if reject() on Mobile
          // so we should resolve([]) here
          resolve([]);
        } else {
          let error = new Error(notMatchedErrorMessage);
          if (isAuthorizedRequired && isNotAuthorized) {
            // debugLogger.dappApprove.error(web3Errors.provider.unauthorized());
            error = web3Errors.provider.unauthorized();
          }
          // do not add delay here, it will cause _openModalByRouteParamsDebounced not working
          reject(error);
        }
      } else {
        this._openModalByRouteParamsDebounced({
          routeNames,
          routeParams,
          modalParams,
        });
      }
    });
  }

  @backgroundMethod()
  sendWebEmbedMessage(payload: {
    method: string;
    event: string;
    params: Record<string, any>;
  }) {
    return new Promise((resolve, reject) => {
      const id = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      this.backgroundApi.providers.$private.handleMethods({
        data: {
          method: payload.method,
          event: payload.event,
          send: this.backgroundApi.sendForProvider('$private'),
          promiseId: id,
          params: payload.params,
        },
      });
    });
  }
}

export default ServiceDapp;
