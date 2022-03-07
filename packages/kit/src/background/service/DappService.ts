import { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

import { getActiveWalletAccount } from '../../hooks/redux';
import { RootRoutes } from '../../routes/types';
import { appSelector } from '../../store';
import { DappSiteConnection } from '../../store/reducers/dapp';
import { IDappCallParams } from '../IBackgroundApi';

import BaseService from './BaseService';

class DappService extends BaseService {
  getConnectedAccounts({ origin }: { origin: string }): DappSiteConnection[] {
    const { networkImpl, accountAddress } = getActiveWalletAccount();
    const connections: DappSiteConnection[] = appSelector(
      (s) => s.dapp.connections,
    );
    const accounts = connections.filter(
      (item) =>
        item.site.origin === origin &&
        item.networkImpl === networkImpl &&
        item.address === accountAddress, // only match current active account
    );
    return accounts;
  }

  async openApprovalModal({
    request,
    screens = [],
  }: {
    request: IJsBridgeMessagePayload;
    screens: any[];
  }) {
    return new Promise((resolve, reject) => {
      const id = this.backgroundApi.createPromiseCallback({
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

      global.$navigationRef.current?.navigate(RootRoutes.Modal, modalParams);

      // TODO extension open new window
      // extUtils.openApprovalWindow();
    });
  }
}

export default DappService;
