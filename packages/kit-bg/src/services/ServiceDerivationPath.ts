import { omit } from 'lodash';

import { OneKeyInternalError } from '@onekeyhq/engine/src/errors';
import { getNextAccountId } from '@onekeyhq/engine/src/managers/derivation';
import { getAccountNameInfoByImpl } from '@onekeyhq/engine/src/managers/impl';
import type { IAccount } from '@onekeyhq/engine/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  IMPL_ADA,
  IMPL_BCH,
  IMPL_BTC,
  IMPL_DOGE,
  IMPL_EVM,
  IMPL_LTC,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceDerivationPath extends ServiceBase {
  @backgroundMethod()
  async getDerivationSelectOptions(networkId: string | undefined) {
    if (!networkId) return [];
    const network = await this.backgroundApi.engine.getNetwork(networkId);
    let accountNameInfo = getAccountNameInfoByImpl(network.impl);
    if (network.impl === IMPL_EVM && network.symbol !== 'ETC') {
      accountNameInfo = omit(accountNameInfo, 'etcNative');
    }
    return Object.entries(accountNameInfo).map(([k, v]) => ({ ...v, key: k }));
  }

  @backgroundMethod()
  async getNetworkDerivations(walletId: string, networkId: string) {
    const walletDerivations =
      await this.backgroundApi.engine.dbApi.getAccountDerivationByWalletId(
        walletId,
      );
    const network = await this.backgroundApi.engine.getNetwork(networkId);
    const accountNameInfo = getAccountNameInfoByImpl(network.impl);
    const networkDerivations = Object.entries(walletDerivations)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, v]) =>
        Object.values(accountNameInfo).find((i) => i.template === v.template),
      )
      .map(([k, v]) => ({ ...v, key: k }));
    const isUTXOImpl = [
      IMPL_BTC,
      IMPL_TBTC,
      IMPL_DOGE,
      IMPL_LTC,
      IMPL_BCH,
      IMPL_ADA,
    ].includes(network.impl);
    const shouldQuickCreate = networkDerivations.length <= 1 && !isUTXOImpl;
    return {
      shouldQuickCreate,
      quickCreateAccountInfo: shouldQuickCreate ? networkDerivations[0] : null,
      networkDerivations,
      accountNameInfo,
    };
  }

  @backgroundMethod()
  async createNewAccount(
    password: string,
    walletId: string,
    networkId: string,
    template: string,
  ) {
    const { serviceAccountSelector, serviceAccount, engine } =
      this.backgroundApi;
    const [wallet, derivationsInfo] = await Promise.all([
      engine.getWallet(walletId),
      this.getNetworkDerivations(walletId, networkId),
    ]);
    const { shouldQuickCreate, quickCreateAccountInfo, accountNameInfo } =
      derivationsInfo;
    const usedTemplate =
      template || (shouldQuickCreate && quickCreateAccountInfo?.template);
    if (!usedTemplate) {
      throw new OneKeyInternalError(
        'create account should pass template param.',
      );
    }

    const accountInfo = Object.values(accountNameInfo).find(
      (v) => v.template === usedTemplate,
    );
    if (!accountInfo) {
      throw new OneKeyInternalError('can not find accountInfo.');
    }
    const { prefix, category } = accountInfo;

    const nextAccountId = getNextAccountId(wallet.nextAccountIds, usedTemplate);
    const name = `${prefix} #${nextAccountId + 1}`;
    const usedPurpose = parseInt(category.split("'/")[0]);

    serviceAccountSelector.preloadingCreateAccount({
      walletId,
      networkId,
    });

    let addedAccount: IAccount | undefined;
    try {
      const account = await serviceAccount.addHDAccounts(
        password,
        walletId,
        networkId,
        undefined,
        [name],
        usedPurpose,
        false,
        usedTemplate,
      );
      addedAccount = account?.[0];
    } catch (e) {
      console.log(e);
      //
    } finally {
      serviceAccountSelector.preloadingCreateAccountDone({
        walletId,
        networkId,
        accountId: addedAccount?.id,
      });
    }
  }
}
