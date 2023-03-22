import {
  OneKeyHardwareError,
  OneKeyInternalError,
} from '@onekeyhq/engine/src/errors';
import { getNextAccountId } from '@onekeyhq/engine/src/managers/derivation';
import type { IAccount } from '@onekeyhq/engine/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { INDEX_PLACEHOLDER } from '@onekeyhq/shared/src/engine/engineConsts';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceDerivationPath extends ServiceBase {
  @backgroundMethod()
  async getDerivationSelectOptions(
    walletId: string | undefined,
    networkId: string | undefined,
  ) {
    if (!networkId || !walletId) return [];
    const vault = await this.backgroundApi.engine.getWalletOnlyVault(
      networkId,
      walletId,
    );
    const accountNameInfo = await vault.getAccountNameInfoMap();
    return Object.entries(accountNameInfo).map(([k, v]) => ({ ...v, key: k }));
  }

  @backgroundMethod()
  async getNetworkDerivations(walletId: string, networkId: string) {
    const walletDerivations =
      await this.backgroundApi.engine.dbApi.getAccountDerivationByWalletId({
        walletId,
      });
    const vault = await this.backgroundApi.engine.getWalletOnlyVault(
      networkId,
      walletId,
    );
    const accountNameInfo = await vault.getAccountNameInfoMap();
    const networkDerivations = Object.entries(walletDerivations)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, v]) =>
        Object.values(accountNameInfo).find((i) => i.template === v.template),
      )
      .map(([k, v]) => ({ ...v, key: k }));

    const shouldQuickCreate =
      networkDerivations.length <= 1 && !vault.settings.isUTXOModel;
    const quickCreateAccountInfo =
      networkDerivations.length > 0
        ? networkDerivations[0]
        : accountNameInfo.default;

    return {
      shouldQuickCreate,
      quickCreateAccountInfo: shouldQuickCreate ? quickCreateAccountInfo : null,
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
      template,
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
    } finally {
      serviceAccountSelector.preloadingCreateAccountDone({
        walletId,
        networkId,
        accountId: addedAccount?.id,
        template: usedTemplate,
      });
    }
  }

  @backgroundMethod()
  async getHWAddressByTemplate({
    networkId,
    walletId,
    index,
    template,
  }: {
    networkId: string;
    walletId: string;
    index: number;
    template: string;
  }) {
    const path = template.replace(INDEX_PLACEHOLDER, index.toString());
    const vault = await this.backgroundApi.engine.getWalletOnlyVault(
      networkId,
      walletId,
    );
    const device = await this.backgroundApi.engine.getHWDeviceByWalletId(
      walletId,
    );
    if (!device) {
      throw new OneKeyInternalError(`Device not found.`);
    }
    try {
      const address = await vault.keyring.getAddress({
        path,
        showOnOneKey: true,
        isTemplatePath: true,
      });

      if (!address) {
        throw new OneKeyInternalError(`Address not found.`);
      }

      const accountExist = await vault.checkAccountExistence(address, true);
      return {
        index,
        path,
        address,
        displayAddress: address,
        accountExist,
      };
    } catch (e) {
      if (e instanceof OneKeyHardwareError) {
        throw e;
      } else {
        throw new OneKeyHardwareError({
          message: 'Failed to get address',
        });
      }
    }
  }
}
