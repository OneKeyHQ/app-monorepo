import BigNumber from 'bignumber.js';
import * as bip39 from 'bip39';

import { DBAPI } from './dbs/base';
import * as errors from './errors';
import * as limits from './limits';
import { ProviderController } from './proxy';
import { WALLET_TYPE_HD, WALLET_TYPE_HW } from './types/wallet';

class Validators {
  private readonly dbApi: DBAPI;

  private readonly providerManager: ProviderController;

  constructor(dbApi: DBAPI, providerManager: ProviderController) {
    this.dbApi = dbApi;
    this.providerManager = providerManager;
  }

  async validateMnemonic(mnemonic: string): Promise<string> {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new errors.InvalidMnemonic();
    }
    return Promise.resolve(mnemonic);
  }

  async validateAddress(networkId: string, address: string): Promise<string> {
    const { normalizedAddress, isValid } =
      await this.providerManager.verifyAddress(networkId, address);
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new errors.InvalidAddress();
    }
    return Promise.resolve(normalizedAddress);
  }

  async validateTokenAddress(
    networkId: string,
    address: string,
  ): Promise<string> {
    const { normalizedAddress, isValid } =
      await this.providerManager.verifyTokenAddress(networkId, address);
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new errors.InvalidTokenAddress();
    }
    return Promise.resolve(normalizedAddress);
  }

  private validateNumericString(value: string): boolean {
    return new BigNumber(value).isFinite();
  }

  async validateTransferValue(value: string): Promise<string> {
    if (!this.validateNumericString(value)) {
      throw new errors.InvalidTransferValue();
    }
    return Promise.resolve(value);
  }

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

  async validateHDWalletNumber(): Promise<void> {
    const hdWallets = (await this.dbApi.getWallets()).filter((w) =>
      w.id.startsWith(WALLET_TYPE_HD),
    );
    if (hdWallets.length >= limits.HD_WALLET_MAX_NUM) {
      throw new errors.TooManyHDWallets(limits.HD_WALLET_MAX_NUM);
    }
    return Promise.resolve();
  }

  async validateHWWalletNumber(): Promise<void> {
    const hwWallets = (await this.dbApi.getWallets()).filter((w) =>
      w.id.startsWith(WALLET_TYPE_HW),
    );
    if (hwWallets.length >= limits.HW_WALLET_MAX_NUM) {
      throw new errors.TooManyHWWallets(limits.HW_WALLET_MAX_NUM);
    }
    return Promise.resolve();
  }
}

export { Validators };
