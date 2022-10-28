/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import * as bip39 from 'bip39';
import { isString } from 'lodash';

import { backgroundMethod } from '@onekeyhq/kit/src/background/decorators';

import {
  COINTYPE_BTC,
  IMPL_BCH,
  IMPL_BTC,
  IMPL_DOGE,
  IMPL_LTC,
  SEPERATOR,
} from './constants';
import { DBAPI } from './dbs/base';
import * as errors from './errors';
import { OneKeyValidatorError, OneKeyValidatorTip } from './errors';
import * as limits from './limits';
import { implToCoinTypes } from './managers/impl';
import { DBUTXOAccount } from './types/account';
import { UserInputCategory, UserInputCheckResult } from './types/credential';
import { WALLET_TYPE_HD, WALLET_TYPE_HW } from './types/wallet';

import type { Engine } from './index';

const FEE_LIMIT_HIGH_VALUE_TIMES = 20;
const FEE_PRICE_HIGH_VALUE_TIMES = 4;

class Validators {
  private _dbApi: DBAPI;

  private engine: Engine;

  constructor(engine: Engine) {
    this.engine = engine;
    this._dbApi = engine.dbApi;
  }

  get dbApi(): DBAPI {
    return this._dbApi;
  }

  set dbApi(dbApi: DBAPI) {
    this._dbApi = dbApi;
  }

  private async validateUserInput(
    input: string,
    forCategories: Array<UserInputCategory> = [],
    returnEarly = false,
  ): Promise<Array<UserInputCheckResult>> {
    const ret = [];
    const filterCategories =
      forCategories.length > 0
        ? forCategories
        : [
            UserInputCategory.MNEMONIC,
            UserInputCategory.IMPORTED,
            UserInputCategory.WATCHING,
            UserInputCategory.ADDRESS,
          ];

    if (filterCategories.includes(UserInputCategory.MNEMONIC)) {
      try {
        await this.validateMnemonic(input);
        // Don't branch if the input is a valid mnemonic.
        return await Promise.resolve([
          { category: UserInputCategory.MNEMONIC },
        ]);
      } catch {
        // pass
      }
    }

    // For implemetations(btc/evm/near/stc) we have at the moment, address
    // or watching input checking can be done with only one network and the
    // result applies to all network with the same implementation.
    // However, things would become complicated when we later introduce
    // cosmos or polkadot networks. Address or watching input checking would
    // have to be done per network/chain basis, instead of per implementation
    // for now.

    for (const [impl, networks] of Object.entries(
      await this.engine.listEnabledNetworksGroupedByVault(),
    )) {
      const vault = await this.engine.getChainOnlyVault(networks[0].id);
      const possibleNetworks = networks.map((network) => network.id);

      let category = UserInputCategory.IMPORTED;
      if (
        filterCategories.includes(category) &&
        (await vault.validateImportedCredential(input))
      ) {
        ret.push({ category, possibleNetworks });
        if (returnEarly) return ret;
      }

      category = UserInputCategory.WATCHING;
      if (
        filterCategories.includes(category) &&
        (await vault.validateWatchingCredential(input))
      ) {
        ret.push({ category, possibleNetworks });
        if (returnEarly) return ret;
      }

      category = UserInputCategory.ADDRESS;
      if (filterCategories.includes(category)) {
        try {
          await vault.validateAddress(input);
          ret.push({ category, possibleNetworks });
        } catch {
          // pass
        }
      }
    }

    return ret;
  }

  @backgroundMethod()
  validateCreateInput({
    input,
    onlyFor,
    returnEarly,
  }: {
    input: string;
    onlyFor?: UserInputCategory;
    returnEarly?: boolean;
  }) {
    return this.validateUserInput(
      input,
      typeof onlyFor !== 'undefined' ? [onlyFor] : [],
      returnEarly,
    );
  }

  @backgroundMethod()
  async validateAnyAddress(input: string): Promise<Array<string>> {
    return (
      await this.validateUserInput(input, [UserInputCategory.ADDRESS])
    ).reduce(
      (networks: Array<string>, { possibleNetworks }) =>
        networks.concat(possibleNetworks || []),
      [],
    );
  }

  @backgroundMethod()
  async validateMnemonic(mnemonic: string): Promise<string> {
    const usedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');
    if (!bip39.validateMnemonic(usedMnemonic)) {
      throw new errors.InvalidMnemonic();
    }
    return Promise.resolve(usedMnemonic);
  }

  @backgroundMethod()
  async validatePasswordStrength(password: string): Promise<string> {
    const p = password || '';
    if (p.length >= 8 && p.length <= 24) {
      return Promise.resolve(password);
    }
    throw new errors.PasswordStrengthValidationFailed();
  }

  @backgroundMethod()
  async validateAddress(networkId: string, address: string): Promise<string> {
    const vault = await this.engine.getChainOnlyVault(networkId);
    const status = await vault.validateAddress(address);
    return status;
  }

  @backgroundMethod()
  async isContractAddress(
    networkId: string,
    address: string,
  ): Promise<boolean> {
    const vault = await this.engine.getChainOnlyVault(networkId);
    return vault.isContractAddress(address);
  }

  @backgroundMethod()
  async validateTokenAddress(
    networkId: string,
    address: string,
  ): Promise<string> {
    const vault = await this.engine.getChainOnlyVault(networkId);
    return vault.validateTokenAddress(address);
  }

  @backgroundMethod()
  async normalizeTokenAddress(
    networkId: string,
    address: string,
  ): Promise<string> {
    try {
      const vault = await this.engine.getChainOnlyVault(networkId);
      return await vault.validateTokenAddress(address);
    } catch (error) {
      return address;
    }
  }

  @backgroundMethod()
  private validateNumericString(value: string): boolean {
    return new BigNumber(value).isFinite();
  }

  @backgroundMethod()
  async validateTransferValue(value: string): Promise<string> {
    if (!this.validateNumericString(value)) {
      throw new errors.InvalidTransferValue();
    }
    return Promise.resolve(value);
  }

  @backgroundMethod()
  async validateWalletName(name: string): Promise<string> {
    if (
      name.length < limits.WALLET_NAME_MIN_LENGTH ||
      name.length > limits.WALLET_NAME_MAX_LENGTH
    ) {
      throw new errors.WalletNameLengthError(
        limits.WALLET_NAME_MIN_LENGTH,
        limits.WALLET_NAME_MAX_LENGTH,
      );
    }
    return Promise.resolve(name);
  }

  @backgroundMethod()
  async validateAccountNames(names: Array<string>): Promise<Array<string>> {
    for (const name of names) {
      if (
        name.length < limits.ACCOUNT_NAME_MIN_LENGTH ||
        name.length > limits.ACCOUNT_NAME_MAX_LENGTH
      ) {
        throw new errors.AccountNameLengthError(
          name,
          limits.ACCOUNT_NAME_MIN_LENGTH,
          limits.ACCOUNT_NAME_MAX_LENGTH,
        );
      }
    }
    return Promise.resolve(names);
  }

  @backgroundMethod()
  async validateHDWalletNumber(): Promise<void> {
    const hdWallets = (await this.dbApi.getWallets()).filter((w) =>
      w.id.startsWith(WALLET_TYPE_HD),
    );
    if (hdWallets.length >= limits.HD_WALLET_MAX_NUM) {
      throw new errors.TooManyHDWallets(limits.HD_WALLET_MAX_NUM);
    }
    return Promise.resolve();
  }

  @backgroundMethod()
  async validateHWWalletNumber(): Promise<void> {
    // ignore passphrase hardware wallet
    const hwWallets = (await this.dbApi.getWallets()).filter((w) =>
      w.id.startsWith(WALLET_TYPE_HW),
    );
    if (hwWallets.length >= limits.HW_WALLET_MAX_NUM) {
      throw new errors.TooManyHWWallets(limits.HW_WALLET_MAX_NUM);
    }
    return Promise.resolve();
  }

  @backgroundMethod()
  async validateAccountAddress(address: string) {
    const wallets = await this.dbApi.getWallets({
      includeAllPassphraseWallet: true,
    });

    const accounts = wallets
      .map((wallet) => wallet.accounts)
      .join(',')
      .split(',');
    const dbAccounts = await this.dbApi.getAccounts(accounts);
    const addresses = dbAccounts.map((acc) => acc.address?.toLowerCase());
    return addresses.includes(address.toLowerCase());
  }

  @backgroundMethod()
  async validateGasLimit({
    networkId,
    value,
    highValue,
  }: {
    networkId: string;
    value: string | BigNumber;
    highValue?: string | number;
  }): Promise<void> {
    const vaultSettings = await this.engine.getVaultSettings(networkId);
    // default: EVM 21000
    const minLimit = vaultSettings.minGasLimit ?? 21000;

    // eslint-disable-next-line no-param-reassign
    highValue = highValue ?? minLimit;
    const minI18nData = {
      0: minLimit,
      1: minLimit,
    };
    try {
      const v = typeof value === 'string' ? new BigNumber(value) : value;
      if (!v || v.isNaN() || v.isLessThan(new BigNumber(minLimit))) {
        throw new OneKeyValidatorError(
          'form__gas_limit_invalid_min',
          minI18nData,
        );
      }
      const maxLimit = new BigNumber(highValue);
      if (v.isGreaterThan(maxLimit.times(FEE_LIMIT_HIGH_VALUE_TIMES))) {
        throw new OneKeyValidatorTip('form__gas_limit_invalid_too_much');
      }
    } catch (e) {
      if (
        e instanceof OneKeyValidatorError ||
        e instanceof OneKeyValidatorTip
      ) {
        throw e;
      }
      throw new OneKeyValidatorError(
        'form__gas_limit_invalid_min',
        minI18nData,
      );
    }
    return Promise.resolve();
  }

  // TODO validateGasPrice
  @backgroundMethod()
  async validateGasPrice({
    networkId,
    value,
    lowValue,
    highValue,
    minValue,
  }: {
    networkId: string;
    value: string;
    lowValue?: string;
    highValue?: string;
    minValue?: string;
  }): Promise<void> {
    const valueBN = new BigNumber(value);
    const minAmount = minValue || '0';
    if (
      !valueBN ||
      valueBN.isNaN() ||
      valueBN.isLessThanOrEqualTo('0') ||
      valueBN.isLessThan(minAmount)
    ) {
      throw new OneKeyValidatorError('form__gas_price_invalid_min_str', {
        0: minAmount,
      });
    }
    if (lowValue && valueBN.isLessThan(lowValue)) {
      throw new OneKeyValidatorTip('form__gas_price_invalid_too_low', {});
    }
    if (
      highValue &&
      valueBN.isGreaterThan(
        new BigNumber(highValue).times(FEE_PRICE_HIGH_VALUE_TIMES),
      )
    ) {
      throw new OneKeyValidatorTip('form__gas_price_invalid_too_much', {});
    }

    return Promise.resolve();
  }

  @backgroundMethod()
  async validateMaxFee({
    networkId,
    maxPriorityFee,
    value,
    lowValue,
    highValue,
    minValue,
  }: {
    networkId: string;
    maxPriorityFee: string | BigNumber;
    value: string | BigNumber;
    lowValue?: string;
    highValue?: string;
    minValue?: string;
  }): Promise<void> {
    try {
      const v = typeof value === 'string' ? new BigNumber(value) : value;
      // TODO  may relate to network
      const minAmount = minValue || '0';
      if (
        !v ||
        v.isNaN() ||
        v.isLessThanOrEqualTo('0') ||
        v.isLessThan(minAmount)
      ) {
        throw new OneKeyValidatorError('form__max_fee_invalid_too_low', {
          0: minAmount,
        });
      }
      const pv =
        typeof maxPriorityFee === 'string'
          ? new BigNumber(maxPriorityFee)
          : maxPriorityFee;
      if (v.isLessThan(pv)) {
        throw new OneKeyValidatorError('form__max_fee_invalid_min');
      }

      if (highValue) {
        const networkMax = new BigNumber(highValue);
        if (v.isGreaterThan(networkMax.times(FEE_PRICE_HIGH_VALUE_TIMES))) {
          throw new OneKeyValidatorTip('form__max_fee_invalid_too_much');
        }
      }
      if (lowValue) {
        if (v.isLessThan(lowValue)) {
          throw new OneKeyValidatorTip('form__max_fee_invalid_too_low', {
            0: lowValue,
          });
        }
      }
    } catch (e) {
      if (
        e instanceof OneKeyValidatorError ||
        e instanceof OneKeyValidatorTip
      ) {
        throw e;
      }
      throw new OneKeyValidatorError('form__max_fee_invalid_too_low');
    }
    return Promise.resolve();
  }

  @backgroundMethod()
  async validateMaxPriortyFee({
    networkId,
    value,
    lowValue,
    highValue,
    minValue,
  }: {
    networkId: string;
    value: string | BigNumber;
    lowValue?: string;
    highValue?: string;
    minValue?: string;
  }): Promise<void> {
    try {
      const v = typeof value === 'string' ? new BigNumber(value) : value;
      // TODO  may relate to network
      const minAmount = minValue || '0';
      if (
        !v ||
        v.isNaN() ||
        v.isLessThanOrEqualTo('0') ||
        v.isLessThan(minAmount)
      ) {
        throw new OneKeyValidatorError('form__max_priority_fee_invalid_min', {
          0: minAmount,
        });
      }
      if (lowValue) {
        if (v.isLessThan(new BigNumber(lowValue))) {
          throw new OneKeyValidatorTip(
            'form__max_priority_fee_invalid_too_low',
          );
        }
      }
      if (highValue) {
        if (
          v.isGreaterThan(
            new BigNumber(highValue).times(FEE_PRICE_HIGH_VALUE_TIMES),
          )
        ) {
          throw new OneKeyValidatorTip(
            'form__max_priority_fee_invalid_too_much',
          );
        }
      }
    } catch (e) {
      if (
        e instanceof OneKeyValidatorError ||
        e instanceof OneKeyValidatorTip
      ) {
        throw e;
      }
      // TODO return original error message
      throw new OneKeyValidatorError('form__max_priority_fee_invalid_min');
    }
    return Promise.resolve();
  }

  @backgroundMethod()
  async isValidEvmTxid({ txid }: { txid: string }) {
    return Promise.resolve(
      isString(txid) && /^0x([A-Fa-f0-9]{64})$/.test(txid),
    );
  }

  @backgroundMethod()
  async validateCanCreateNextAccount(
    walletId: string,
    networkId: string,
    purpose: number,
  ): Promise<void> {
    const [wallet, network] = await Promise.all([
      this.engine.getWallet(walletId),
      this.engine.getNetwork(networkId),
    ]);
    if ([IMPL_BTC, IMPL_DOGE, IMPL_LTC, IMPL_BCH].includes(network.impl)) {
      const coinType = implToCoinTypes[network.impl] ?? COINTYPE_BTC;
      const accountPathPrefix = `${purpose}'/${coinType}'`;
      const nextAccountId = wallet.nextAccountIds[accountPathPrefix];
      if (typeof nextAccountId !== 'undefined' && nextAccountId > 0) {
        const lastAccountId = `${walletId}${SEPERATOR}m/${accountPathPrefix}/${
          nextAccountId - 1
        }'`;
        const [lastAccount] = await this.dbApi.getAccounts([lastAccountId]);
        if (typeof lastAccount !== 'undefined') {
          const vault = await this.engine.getChainOnlyVault(networkId);
          const accountExisted = await vault.checkAccountExistence(
            (lastAccount as DBUTXOAccount).xpub,
          );
          if (!accountExisted) {
            const accountTypeStr =
              (
                Object.values(network.accountNameInfo).find(
                  ({ category }) => accountPathPrefix === category,
                ) || {}
              ).label || '';
            throw new errors.PreviousAccountIsEmpty(accountTypeStr);
          }
        }
      }
    }
    return Promise.resolve();
  }
}

export { Validators };
