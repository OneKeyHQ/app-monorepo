import { IWalletConnectSession } from '@walletconnect/types';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';

import { WalletService } from '../../components/WalletConnect/types';
import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
class ServiceWalletConnect extends ServiceBase {
  @backgroundMethod()
  async getExternalAccountImage({ accountId }: { accountId: string }) {
    return simpleDb.walletConnect.getExternalAccountImage({ accountId });
  }

  @backgroundMethod()
  async getExternalAccountSession({ accountId }: { accountId: string }) {
    return simpleDb.walletConnect.getExternalAccountSession({ accountId });
  }

  @backgroundMethod()
  async findWalletServiceBySession({
    session,
  }: {
    session: IWalletConnectSession;
  }) {
    return simpleDb.walletConnect.findWalletServiceBySession({ session });
  }

  @backgroundMethod()
  async getWalletServicesList() {
    return simpleDb.walletConnect.getWalletServicesList();
  }

  @backgroundMethod()
  async saveWalletServicesList(list: WalletService[]) {
    return simpleDb.walletConnect.saveWalletServicesList(list);
  }

  @backgroundMethod()
  async removeWalletSession(walletUrl: string | undefined) {
    return simpleDb.walletConnect.removeWalletSession(walletUrl);
  }

  @backgroundMethod()
  async saveExternalAccountSession({
    accountId,
    session,
    walletService,
  }: {
    accountId: string;
    session: IWalletConnectSession;
    walletService?: WalletService;
  }) {
    return simpleDb.walletConnect.saveExternalAccountSession({
      accountId,
      session,
      walletService,
    });
  }
}

export default ServiceWalletConnect;
