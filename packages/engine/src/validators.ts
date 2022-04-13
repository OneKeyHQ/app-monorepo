import BigNumber from 'bignumber.js';
import * as bip39 from 'bip39';

import { backgroundMethod } from '@onekeyhq/kit/src/background/decorators';

import { getSupportedImpls } from './constants';
import { DBAPI } from './dbs/base';
import * as errors from './errors';
import * as limits from './limits';
import { implToAccountType } from './managers/impl';
import { ProviderController } from './proxy';
import { AccountType } from './types/account';
import { UserCreateInput, UserCreateInputCategory } from './types/credential';
import { WALLET_TYPE_HD, WALLET_TYPE_HW } from './types/wallet';

class Validators {
  private _dbApi: DBAPI;

  private readonly providerManager: ProviderController;

  constructor(dbApi: DBAPI, providerManager: ProviderController) {
    this._dbApi = dbApi;
    this.providerManager = providerManager;
  }

  get dbApi(): DBAPI {
    return this._dbApi;
  }

  set dbApi(dbApi: DBAPI) {
    this._dbApi = dbApi;
  }

  @backgroundMethod()
  async validateCreateInput(input: string): Promise<UserCreateInput> {
    let category = UserCreateInputCategory.INVALID;
    let possibleNetworks: Array<string> = [];
    if (/\s/g.test(input)) {
      // white space in input, only try mnemonic
      try {
        await this.validateMnemonic(input);
        category = UserCreateInputCategory.MNEMONIC;
      } catch {
        console.log('Invalid mnemonic', input);
      }
    } else {
      const enabledNetworks = (await this.dbApi.listNetworks()).filter(
        (dbNetwork) =>
          dbNetwork.enabled && getSupportedImpls().has(dbNetwork.impl),
      );
      if (/^(0x)?[0-9a-zA-Z]{64}$/.test(input)) {
        // a 64-char hexstring with or without 0x prefix, try private key only
        // TODO: verify private key & return networks with specific curve.
        category = UserCreateInputCategory.PRIVATE_KEY;
        possibleNetworks = enabledNetworks.map((network) => network.id);
      } else {
        // check whether input is an address of any network
        const selectedImpls = new Set();
        for (const network of enabledNetworks) {
          const { id: networkId, impl } = network;
          let networkIsPossible = true;
          if (!selectedImpls.has(impl)) {
            try {
              await this.validateAddress(networkId, input);
              if (implToAccountType[impl] === AccountType.SIMPLE) {
                selectedImpls.add(impl);
              }
            } catch {
              networkIsPossible = false;
            }
          }
          if (networkIsPossible) {
            possibleNetworks.push(networkId);
          }
        }
        if (possibleNetworks.length > 0) {
          category = UserCreateInputCategory.ADDRESS;
        }
      }
    }
    return { category, possibleNetworks };
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
  async validateAddress(networkId: string, address: string): Promise<string> {
    const { normalizedAddress, isValid } =
      await this.providerManager.verifyAddress(networkId, address);
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new errors.InvalidAddress();
    }
    return Promise.resolve(normalizedAddress);
  }

  @backgroundMethod()
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
    const wallets = await this.dbApi.getWallets();

    const accounts = wallets
      .map((wallet) => wallet.accounts)
      .join(',')
      .split(',');
    const dbAccounts = await this.dbApi.getAccounts(accounts);
    const addresses = dbAccounts.map((acc) => acc.address?.toLowerCase());
    return addresses.includes(address.toLowerCase());
  }
}

export { Validators };
