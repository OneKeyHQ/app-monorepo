import type {
  IBaseExternalAccountInfo,
  IExternalAccountType,
} from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityWalletConnect';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';

import { backgroundClass, backgroundMethod } from '../decorators';

import ServiceBase from './ServiceBase';

import type { WalletService } from '../../components/WalletConnect/types';

@backgroundClass()
export default class ServiceExternalAccount extends ServiceBase {
  @backgroundMethod()
  async getExternalAccountImage({ accountId }: { accountId: string }) {
    return simpleDb.walletConnect.getExternalAccountImage({ accountId });
  }

  @backgroundMethod()
  async generateExternalAccountInfoFromWalletService({
    walletService,
    externalAccountType,
  }: {
    walletService: WalletService;
    externalAccountType: IExternalAccountType;
  }) {
    const accountInfo =
      simpleDb.walletConnect.getBaseExternalAccountInfoFromWalletService({
        walletService,
      });
    accountInfo.type = externalAccountType;
    return Promise.resolve(accountInfo);
  }

  @backgroundMethod()
  async saveExternalAccountInfo({
    accountId,
    accountInfo,
  }: {
    accountId: string;
    accountInfo: IBaseExternalAccountInfo;
  }) {
    return simpleDb.walletConnect.saveExternalAccountInfo({
      accountId,
      accountInfo,
    });
  }
}
