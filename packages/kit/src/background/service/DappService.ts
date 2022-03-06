import { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getActiveWalletAccount } from '../../hooks/redux';
import {
  DappConnectionModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../routes/routesEnum';
import { appSelector } from '../../store';
import {
  DappSiteConnection,
  DappSiteConnectionSavePayload,
  dappSaveSiteConnection,
} from '../../store/reducers/dapp';
import { IDappCallParams } from '../IBackgroundApi';

import BaseService from './BaseService';

class DappService extends BaseService {
  getConnectedAccounts({ origin }: { origin: string }): DappSiteConnection[] {
    const { networkImpl, accountAddress } = getActiveWalletAccount();
    const connections: DappSiteConnection[] = appSelector(
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

  saveConnectedAccounts(payload: DappSiteConnectionSavePayload) {
    this.backgroundApi.dispatchAction(dappSaveSiteConnection(payload));
  }

  openConnectionApprovalModal({
    request,
  }: {
    request: IJsBridgeMessagePayload;
  }) {
    return this.openApprovalModal({
      request,
      screens: [
        ModalRoutes.DappConnectionModal,
        DappConnectionModalRoutes.ConnectionModal,
      ],
    });
  }

  async openApprovalModal({
    request,
    screens = [],
  }: {
    request: IJsBridgeMessagePayload;
    screens: any[];
  }) {
    return new Promise((resolve, reject) => {
      const id = this.backgroundApi.promiseContainer.createCallback({
        resolve,
        reject,
      });
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
      paramsLast.params = {
        id,
        origin: request.origin,
        scope: request.scope, // ethereum
        data: JSON.stringify(request.data),
      } as IDappCallParams;

      if (platformEnv.isExtension) {
        console.log(
          'open new window in ext: openApprovalModal()',
          RootRoutes.Modal,
          modalParams,
        );
      } else {
        global.$navigationRef.current?.navigate(RootRoutes.Modal, modalParams);
      }

      // TODO extension open new window
      // extUtils.openApprovalWindow();
    });
  }
}

export default DappService;
