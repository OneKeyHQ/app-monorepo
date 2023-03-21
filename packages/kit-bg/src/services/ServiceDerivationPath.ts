import BigNumber from 'bignumber.js';

import { OneKeyInternalError } from '@onekeyhq/engine/src/errors';
import { getNextAccountId } from '@onekeyhq/engine/src/managers/derivation';
import type { IAccount } from '@onekeyhq/engine/src/types';
import type {
  Account,
  DBUTXOAccount,
} from '@onekeyhq/engine/src/types/account';
import type VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

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
    console.log(accounts);
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
        .shiftedBy(decimals)
        .toFixed(),
    }));
  }
}
