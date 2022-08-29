import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import { cloneDeep, debounce } from 'lodash';

import { getActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { buildModalRouteParams } from '@onekeyhq/kit/src/provider/useAutoNavigateOnMount';
import {
  DappSiteConnection,
  DappSiteConnectionRemovePayload,
  DappSiteConnectionSavePayload,
  dappRemoveSiteConnections,
  dappSaveSiteConnection,
} from '@onekeyhq/kit/src/store/reducers/dapp';
import extUtils from '@onekeyhq/kit/src/utils/extUtils';
import { DappConnectionModalRoutes } from '@onekeyhq/kit/src/views/DappModals/types';
import { ManageNetworkRoutes } from '@onekeyhq/kit/src/views/ManageNetworks/types';
import { ManageTokenRoutes } from '@onekeyhq/kit/src/views/ManageTokens/types';
import { SendRoutes } from '@onekeyhq/kit/src/views/Send/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { backgroundClass, backgroundMethod } from '../decorators';
import { IDappSourceInfo } from '../IBackgroundApi';
import { ensureSerializable, isDappScopeMatchNetwork } from '../utils';

import ServiceBase from './ServiceBase';

type CommonRequestParams = {
  request: IJsBridgeMessagePayload;
};

@backgroundClass()
class ServiceDapp extends ServiceBase {
  // TODO rename getActiveConnectedAccounts
  getConnectedAccounts({ origin }: { origin: string }): DappSiteConnection[] {
    // TODO unlock status check
    const { networkImpl, accountAddress } = getActiveWalletAccount();
    const connections: DappSiteConnection[] = this.backgroundApi.appSelector(
      (s) => s.dapp.connections,
    );
    const accounts = connections
      .filter(
        (item) =>
          item.site.origin === origin && item.networkImpl === networkImpl,
        // && item.address === accountAddress, // only match current active account
      )
      .filter((item) => item.address && item.networkImpl);

    if (accounts.length) {
      const list = cloneDeep(accounts);
      // support all accounts for dapp connection, do NOT need approval again
      list.forEach((item) => (item.address = accountAddress));
      return list;
    }
    return accounts;
  }

  @backgroundMethod()
  saveConnectedAccounts(payload: DappSiteConnectionSavePayload) {
    this.backgroundApi.dispatch(dappSaveSiteConnection(payload));
  }

  @backgroundMethod()
  removeConnectedAccounts(payload: DappSiteConnectionRemovePayload) {
    this.backgroundApi.dispatch(dappRemoveSiteConnections(payload));
  }

  // TODO to decorator @permissionRequired()
  authorizedRequired(request: IJsBridgeMessagePayload) {
    if (!this.isDappAuthorized(request)) {
      throw web3Errors.provider.unauthorized();
    }
  }

  isDappAuthorized(request: IJsBridgeMessagePayload) {
    const accounts = this.backgroundApi.serviceDapp?.getConnectedAccounts({
      origin: request.origin as string,
    });
    return Boolean(accounts && accounts.length);
  }

  openConnectionModal(request: CommonRequestParams['request']) {
    return this.openModal({
      request,
      screens: [
        ModalRoutes.DappConnectionModal,
        DappConnectionModalRoutes.ConnectionModal,
      ],
    });
  }

  openSignAndSendModal(request: IJsBridgeMessagePayload, params: any) {
    // Move authorizedRequired to UI check
    // this.authorizedRequired(request);

    return this.openModal({
      request,
      screens: [ModalRoutes.Send, SendRoutes.SendConfirmFromDapp],
      params,
      isAuthorizedRequired: true,
    });
  }

  openAddTokenModal(request: IJsBridgeMessagePayload, params: any) {
    return this.openModal({
      request,
      screens: [ModalRoutes.ManageToken, ManageTokenRoutes.AddToken],
      params,
    });
  }

  openAddNetworkModal(request: IJsBridgeMessagePayload, params: any) {
    return this.openModal({
      request,
      screens: [
        ModalRoutes.ManageNetwork,
        ManageNetworkRoutes.AddNetworkConfirm,
      ],
      params,
    });
  }

  openSwitchNetworkModal(request: IJsBridgeMessagePayload, params: any) {
    return this.openModal({
      request,
      screens: [ModalRoutes.ManageNetwork, ManageNetworkRoutes.SwitchNetwork],
      params,
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
      extUtils.openStandaloneWindow({
        routes: routeNames,
        params: routeParams,
      });
    } else {
      global.$navigationRef.current?.navigate(
        modalParams.screen,
        modalParams.params,
      );
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
      network?.impl,
    );

    if (isAuthorizedRequired && isNotAuthorized) {
      // TODO show different modal for isNotAuthorized
      isNotMatchedNetwork = true;
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
      const sourceInfo = {
        id,
        origin: request.origin,
        scope: request.scope, // ethereum
        data: request.data,
      } as IDappSourceInfo;
      const routeParams = {
        // stringify required, nested object not working with Ext route linking
        query: JSON.stringify({
          sourceInfo, // TODO rename $sourceInfo
          ...params,
        }),
      };

      const modalParams = buildModalRouteParams({
        screens: routeNames,
        routeParams,
      });

      ensureSerializable(modalParams);

      if (isNotMatchedNetwork) {
        this._openModalByRouteParamsDebounced({
          routeNames,
          routeParams,
          modalParams,
        });
        const requestMethod = (request.data as IJsonRpcRequest)?.method || '';
        if (requestMethod === 'eth_requestAccounts') {
          // some dapps like https://polymm.finance/ will call `eth_requestAccounts` infinitely if reject() on Mobile
          // so we should resolve([]) here
          resolve([]);
        } else {
          let error = new Error(
            `OneKey Wallet chain/network not matched. method=${requestMethod} scope=${
              request.scope || ''
            }`,
          );
          if (isAuthorizedRequired && isNotAuthorized) {
            // debugLogger.dappApprove.error(web3Errors.provider.unauthorized());
            error = web3Errors.provider.unauthorized();
          }
          reject(error);
        }
      } else {
        this._openModalByRouteParams({
          routeNames,
          routeParams,
          modalParams,
        });
      }
    });
  }
}

export default ServiceDapp;
