import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

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
import { ensureSerializable, scopeMatchNetwork } from '../utils';

import ServiceBase from './ServiceBase';

type CommonRequestParams = {
  request: IJsBridgeMessagePayload;
};

@backgroundClass()
class ServiceDapp extends ServiceBase {
  getConnectedAccounts({ origin }: { origin: string }): DappSiteConnection[] {
    // TODO unlock status check
    const { networkImpl, accountAddress } = getActiveWalletAccount();
    const connections: DappSiteConnection[] = this.backgroundApi.appSelector(
      (s) => s.dapp.connections,
    );
    const accounts = connections
      .filter(
        (item) =>
          item.site.origin === origin &&
          item.networkImpl === networkImpl &&
          item.address === accountAddress, // only match current active account
      )
      .filter((item) => item.address && item.networkImpl);
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
      if (!scopeMatchNetwork(request.scope, network?.impl)) {
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
    });
  }
}

export default ServiceDapp;
