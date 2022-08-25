import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  IJsBridgeMessagePayload,
  IJsonRpcRequest,
} from '@onekeyfe/cross-inpage-provider-types';
import { cloneDeep, debounce } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getActiveWalletAccount } from '../../hooks/redux';
import { buildModalRouteParams } from '../../provider/useAutoNavigateOnMount';
import {
  DappModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../routes/routesEnum';
import {
  DappSiteConnection,
  DappSiteConnectionRemovePayload,
  DappSiteConnectionSavePayload,
  dappRemoveSiteConnections,
  dappSaveSiteConnection,
} from '../../store/reducers/dapp';
import extUtils from '../../utils/extUtils';
import { DappConnectionModalRoutes } from '../../views/DappModals/types';
import { ManageNetworkRoutes } from '../../views/ManageNetworks/types';
import { ManageTokenRoutes } from '../../views/ManageTokens/types';
import { SendRoutes } from '../../views/Send/types';
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
    const accounts = this.backgroundApi.serviceDapp?.getConnectedAccounts({
      origin: request.origin as string,
    });
    if (!accounts || !accounts.length) {
      // TODO move to UI check
      throw web3Errors.provider.unauthorized();
    }
  }

  openConnectionModal(request: CommonRequestParams['request']) {
    return this.openModal({
      request,
      screens: [
        ModalRoutes.DappConnectionModal,
        DappModalRoutes.ConnectionModal,
      ],
    });
  }

  openApprovalModal(request: IJsBridgeMessagePayload, params: any) {
    this.authorizedRequired(request);
    return this.openModal({
      request,
      screens: [ModalRoutes.Send, SendRoutes.SendConfirmFromDapp],
      params,
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
  }: {
    request: IJsBridgeMessagePayload;
    screens: any[];
    params?: any;
  }) {
    return new Promise((resolve, reject) => {
      const id = this.backgroundApi.servicePromise.createCallback({
        resolve,
        reject,
      });
      const { network } = getActiveWalletAccount();
      let modalScreens = screens;
      let isNotMatchedNetwork = false;
      // TODO not matched network modal should be singleton and debounced
      if (!isDappScopeMatchNetwork(request.scope, network?.impl)) {
        modalScreens = [
          ModalRoutes.DappConnectionModal,
          DappConnectionModalRoutes.NetworkNotMatchModal,
        ];
        isNotMatchedNetwork = true;
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
          reject(
            new Error(
              `OneKey Wallet chain/network not matched. method=${requestMethod}`,
            ),
          );
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
