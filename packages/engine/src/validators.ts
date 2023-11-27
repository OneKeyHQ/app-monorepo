/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import * as bip39 from 'bip39';
import { isString } from 'lodash';

import type { Network } from '@onekeyhq/kit/src/store/typings';
import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  IMPL_COSMOS,
  IMPL_DOT,
  IMPL_XMR,
} from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import * as errors from './errors';
import { OneKeyValidatorError, OneKeyValidatorTip } from './errors';
import * as limits from './limits';
import { decodePassword } from './secret/encryptors/aes256';
import { UserInputCategory } from './types/credential';
import { WALLET_TYPE_HD, WALLET_TYPE_HW } from './types/wallet';

import type { DBAPI } from './dbs/base';
import type { Engine } from './index';
import type { UserInputCheckResult } from './types/credential';
import type { AccountNameInfo } from './types/network';

const FEE_LIMIT_HIGH_VALUE_TIMES = 20;
const FEE_PRICE_HIGH_VALUE_TIMES = 4;

const FORK_CHAIN_ADDRESS_NOT_DIFFERENT = [IMPL_COSMOS, IMPL_DOT];
const WEBVIEW_BACKED_CHAIN = platformEnv.isNative ? [IMPL_XMR] : [];

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

  private async matchingInputType(
    input: string,
    networks: Network[],
    filterCategories: Array<UserInputCategory> = [],
    returnEarly = false,
  ): Promise<UserInputCheckResult[]> {
    const ret = [];

    const networkId = networks[0].id;
    const vault = await this.engine.getChainOnlyVault(networkId);
    const possibleNetworks = networks.map((network) => network.id);

    let derivationOptions: AccountNameInfo[] | undefined;
    let category = UserInputCategory.IMPORTED;
    if (
      filterCategories.includes(category) &&
      (await vault.validateImportedCredential(input))
    ) {
      derivationOptions =
        await vault.getAccountNameInfosByImportedOrWatchingCredential(input);

      if (returnEarly)
        return [{ category, possibleNetworks, derivationOptions }];
      ret.push({ category, possibleNetworks, derivationOptions });
    }

    category = UserInputCategory.WATCHING;
    if (
      filterCategories.includes(category) &&
      (await vault.validateWatchingCredential(input))
    ) {
      if (!derivationOptions) {
        derivationOptions =
          await vault.getAccountNameInfosByImportedOrWatchingCredential(input);
      }
      if (returnEarly)
        return [{ category, possibleNetworks, derivationOptions }];
      ret.push({ category, possibleNetworks, derivationOptions });
    }

    category = UserInputCategory.ADDRESS;
    if (filterCategories.includes(category)) {
      try {
        await vault.validateAddress(input);
        if (returnEarly) return [{ category, possibleNetworks }];
        ret.push({ category, possibleNetworks });
      } catch {
        // pass
      }
    }

    return ret;
  }

  private async validateUserInput(
    input: string,
    forCategories: Array<UserInputCategory> = [],
    selectedNetwork: Network | undefined = undefined,
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
        return [{ category: UserInputCategory.MNEMONIC }];
      } catch {
        // pass
      }
    }

    if (selectedNetwork) {
      const result = await this.matchingInputType(
        input,
        [selectedNetwork],
        filterCategories,
      ).catch();

      if (result && result.length > 0) {
        ret.push(...result);
      }
    }

    return ret;
  }

  @backgroundMethod()
  validateCreateInput({
    input,
    onlyFor,
    selectedNetwork,
  }: {
    input: string;
    onlyFor?: UserInputCategory;
    selectedNetwork?: Network;
  }) {
    return this.validateUserInput(
      input,
      onlyFor !== undefined ? [onlyFor] : [],
      selectedNetwork,
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
    const p = decodePassword({ password });
    if (p.length >= 8 && p.length <= 128) {
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
  async validatePreSendAddress({
    address,
    networkId,
    accountId,
  }: {
    address: string;
    networkId: string;
    accountId: string;
  }) {
    const vaultSettings = await this.engine.getVaultSettings(networkId);
    if (vaultSettings.cannotSendToSelf) {
      const account = await this.dbApi.getAccount(accountId);
      if (account.address === address) {
        const [network] = await Promise.all([
          this.engine.getNetwork(networkId),
        ]);
        throw new errors.InvalidSameAddress(
          'form__address_cannot_send_to_myself',
          {
            0: network.name,
          },
        );
      }
    }
    return Promise.resolve();
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

      if (
        v.isGreaterThan(
          new BigNumber(highValue).times(FEE_LIMIT_HIGH_VALUE_TIMES),
        )
      ) {
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
    const vaultSettings = await this.engine.getVaultSettings(networkId);
    const { minGasPrice } = vaultSettings.subNetworkSettings?.[networkId] || {};

    let minAmount = minGasPrice || minValue || '0';
    if (
      minValue &&
      minGasPrice &&
      new BigNumber(minValue).isGreaterThan(minGasPrice)
    ) {
      minAmount = minValue;
    }

    const valueBN = new BigNumber(value);
    if (!minGasPrice && valueBN.isLessThanOrEqualTo(0)) {
      throw new OneKeyValidatorError('form__gas_price_invalid_min_str', {
        0: 0,
      });
    }

    if (!valueBN || valueBN.isNaN() || valueBN.isLessThan(minAmount)) {
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
        throw new OneKeyValidatorError(
          'msg__custom_fee_warning_max_fee_is_lower_than_priority_fee',
        );
      }

      if (highValue) {
        const networkMax = new BigNumber(highValue);
        if (v.isGreaterThan(networkMax.times(FEE_PRICE_HIGH_VALUE_TIMES))) {
          throw new OneKeyValidatorTip(
            'msg__custom_fee_warning_max_fee_is_high',
          );
        }
      }
      if (lowValue) {
        if (v.isLessThan(lowValue)) {
          throw new OneKeyValidatorTip(
            'msg__custom_fee_warning_max_fee_is_low',
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
            'msg__custom_fee_warning_priority_fee_is_low',
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
            'msg__custom_fee_warning_priority_fee_is_high',
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
    template: string,
  ): Promise<void> {
    const vault = await this.engine.getChainOnlyVault(networkId);
    await vault.validateCanCreateNextAccount(walletId, template);
    return Promise.resolve();
  }
}

export { Validators };
