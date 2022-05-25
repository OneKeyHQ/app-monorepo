import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getActiveWalletAccount } from '../../hooks/redux';
import {
  DappModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../routes/routesEnum';
import {
  DappSiteConnection,
  DappSiteConnectionSavePayload,
  dappSaveSiteConnection,
} from '../../store/reducers/dapp';
import extUtils from '../../utils/extUtils';
import { ManageNetworkRoutes } from '../../views/ManageNetworks/types';
import { ManageTokenRoutes } from '../../views/ManageTokens/types';
import { SendRoutes } from '../../views/Send/types';
import { backgroundClass, backgroundMethod } from '../decorators';
import { IDappCallParams } from '../IBackgroundApi';
import { ensureSerializable } from '../utils';

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
      const routeNames = [RootRoutes.Modal, ...screens];
      const sourceInfo = {
        id,
        origin: request.origin,
        scope: request.scope, // ethereum
        data: request.data,
      } as IDappCallParams;
      const routeParams = {
        // stringify required, nested object not working with Ext route linking
        query: JSON.stringify({
          sourceInfo,
          ...params,
        }),
      };

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

      ensureSerializable(modalParams);

      if (platformEnv.isExtension) {
        extUtils.openStandaloneWindow({
          routes: routeNames,
          params: routeParams,
        });
      } else {
        global.$navigationRef.current?.navigate(RootRoutes.Modal, modalParams);
      }
    });
  }
}

export default ServiceDapp;
