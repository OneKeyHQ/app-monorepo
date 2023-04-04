import BigNumber from 'bignumber.js';

import {
  OneKeyErrorClassNames,
  OneKeyHardwareError,
  OneKeyInternalError,
} from '@onekeyhq/engine/src/errors';
import { getNextAccountId } from '@onekeyhq/engine/src/managers/derivation';
import type { IAccount } from '@onekeyhq/engine/src/types';
import type {
  Account,
  DBUTXOAccount,
  ImportableHDAccount,
} from '@onekeyhq/engine/src/types/account';
import type VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { INDEX_PLACEHOLDER } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

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
    fullPath,
  }: {
    networkId: string;
    walletId: string;
    index: number;
    template: string;
    fullPath?: string;
  }) {
    const path =
      fullPath || template.replace(INDEX_PLACEHOLDER, index.toString());
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

      let accountExist = true;
      if (vault.settings.isUTXOModel) {
        accountExist = await vault.checkAccountExistence(address, true);
      }
      const displayAddress = await this.backgroundApi.engine.getDisplayAddress(
        networkId,
        address,
      );
      return {
        index,
        path,
        address,
        displayAddress,
        accountExist,
      };
    } catch (e: any) {
      const { className } = e || {};
      if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
        throw e;
      } else {
        throw new OneKeyHardwareError({
          message: 'Failed to get address',
        });
      }
    }
  }

  @backgroundMethod()
  async getAllUsedAddress({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    if (!accountId || !networkId) {
      return [];
    }
    const vault = await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    });
    return vault.getAllUsedAddress();
  }

  @backgroundMethod()
  async batchGetHWAddress({
    networkId,
    walletId,
    indexes,
    confirmOnDevice,
    template,
    fullPaths,
  }: {
    networkId: string;
    walletId: string;
    indexes: number[];
    confirmOnDevice: boolean;
    template: string;
    fullPaths?: string[];
  }) {
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
    const bundle = fullPaths
      ? fullPaths.map((path) => ({ path, showOnOneKey: confirmOnDevice }))
      : indexes.map((index) => ({
          path: template.replace(INDEX_PLACEHOLDER, index.toString()),
          showOnOneKey: confirmOnDevice,
        }));
    const response = await vault.keyring.batchGetAddress(bundle);
    return Promise.all(
      response.map(async (item, idx) => {
        const importableAccount =
          await this.convertPlainAddressItemToImportableHDAccount({
            networkId,
            ...item,
          });
        return {
          ...importableAccount,
          ...item,
          index: indexes?.[idx],
        };
      }),
    );
  }

  @backgroundMethod()
  async convertPlainAddressItemToImportableHDAccount({
    networkId,
    address,
    path,
  }: {
    networkId: string;
    address: string;
    path: string;
  }): Promise<ImportableHDAccount> {
    const displayAddress = await this.backgroundApi.engine.getDisplayAddress(
      networkId,
      address,
    );
    return {
      displayAddress,
      path,
      index: -1,
      defaultName: '',
      mainBalance: '0',
    };
  }

  @backgroundMethod()
  async createAccountByCustomAddressIndex({
    networkId,
    accountId,
    password,
    template,
    addressIndex,
    account,
  }: {
    networkId: string;
    accountId: string;
    password: string;
    template: string;
    addressIndex: string;
    account?: Account;
  }) {
    if (!account) {
      throw new Error('no account');
    }
    const vault = await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    });
    const accountIndex = account.path.split('/')[3].slice(0, -1);
    try {
      const accounts = await vault.keyring.prepareAccountByAddressIndex({
        password,
        template,
        accountIndex: Number(accountIndex),
        addressIndex: Number(addressIndex),
      });
      if (accounts.length) {
        await this.backgroundApi.engine.dbApi.updateUTXOAccountAddresses({
          accountId,
          addresses: (accounts[0] as DBUTXOAccount).customAddresses ?? {},
          isCustomPath: true,
        });
      }
    } catch (e) {
      debugLogger.common.error('createAccountByCustomAddressIndex error: ', e);
      throw e;
    }
  }

  @backgroundMethod()
  async removeCustomAddress({
    accountId,
    addresses,
  }: {
    accountId: string;
    addresses: Record<string, string>;
  }) {
    if (!Object.keys(addresses).length) return;
    await this.backgroundApi.engine.dbApi.removeUTXOAccountAddresses({
      accountId,
      addresses,
      isCustomPath: true,
    });
  }

  @backgroundMethod()
  async fetchCustomAddressBalance({
    networkId,
    accountId,
    addresses,
    decimals,
  }: {
    networkId: string;
    accountId: string;
    addresses: string[];
    decimals: number;
  }) {
    const vault = (await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    })) as unknown as VaultBtcFork;
    const balances = await vault.getBalancesByAddress(
      addresses.map((i) => ({ address: i })),
    );
    return addresses.map((address, index) => ({
      address,
      balance: new BigNumber(balances[index] ?? 0)
        .shiftedBy(-decimals)
        .toFixed(),
    }));
  }
}
