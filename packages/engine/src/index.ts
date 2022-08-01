/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import {
  mnemonicFromEntropy,
  revealableSeedFromMnemonic,
} from '@onekeyfe/blockchain-libs/dist/secret';
import { encrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import * as bip39 from 'bip39';
import { baseDecode } from 'borsh';
import bs58check from 'bs58check';
import { cloneDeep } from 'lodash';
import memoizee from 'memoizee';
import natsort from 'natsort';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/kit/src/background/decorators';
import { TokenChartData } from '@onekeyhq/kit/src/store/reducers/tokens';
import { Avatar } from '@onekeyhq/kit/src/utils/emojiUtils';
import { getDeviceType, getDeviceUUID } from '@onekeyhq/kit/src/utils/hardware';
import { generateUUID } from '@onekeyhq/kit/src/utils/helper';
import { SendConfirmPayload } from '@onekeyhq/kit/src/views/Send/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import {
  COINTYPE_BTC,
  IMPL_BTC,
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_SOL,
  getSupportedImpls,
} from './constants';
import { DbApi } from './dbs';
import {
  DBAPI,
  DEFAULT_VERIFY_STRING,
  ExportedSeedCredential,
  checkPassword,
} from './dbs/base';
import {
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from './errors';
import {
  getWalletIdFromAccountId,
  isAccountCompatibleWithNetwork,
} from './managers/account';
import { getDefaultPurpose } from './managers/derivation';
import { implToCoinTypes } from './managers/impl';
import {
  fromDBNetworkToNetwork,
  getEVMNetworkToCreate,
  getImplFromNetworkId,
} from './managers/network';
import { getNetworkIdFromTokenId } from './managers/token';
import { walletCanBeRemoved, walletIsHD } from './managers/wallet';
import {
  getPresetNetworks,
  getPresetToken,
  getPresetTokensOnNetwork,
  networkIsPreset,
} from './presets';
import {
  getDefaultStableTokens,
  syncLatestNetworkList,
} from './presets/network';
import {
  PriceController,
  ProviderController,
  fromDBNetworkToChainInfo,
} from './proxy';
import {
  Account,
  AccountType,
  DBAccount,
  DBUTXOAccount,
  DBVariantAccount,
  ImportableHDAccount,
} from './types/account';
import { CredentialType } from './types/credential';
import { DevicePayload } from './types/device';
import {
  HistoryEntry,
  HistoryEntryMeta,
  HistoryEntryStatus,
  HistoryEntryTransaction,
  HistoryEntryType,
} from './types/history';
import {
  AddNetworkParams,
  DBNetwork,
  EIP1559Fee,
  Network,
  UpdateNetworkParams,
} from './types/network';
import { Token } from './types/token';
import { Wallet } from './types/wallet';
import { Validators } from './validators';
import { createVaultHelperInstance } from './vaults/factory';
import { getMergedTxs } from './vaults/impl/evm/decoder/history';
import { IEncodedTxEvm, IUnsignedMessageEvm } from './vaults/impl/evm/Vault';
import {
  IDecodedTx,
  IDecodedTxInteractInfo,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfoUnit,
  IVaultSettings,
} from './vaults/types';
import { VaultFactory } from './vaults/VaultFactory';

import type VaultEvm from './vaults/impl/evm/Vault';
import type { ITransferInfo } from './vaults/types';

@backgroundClass()
class Engine {
  public dbApi: DBAPI;

  public providerManager: ProviderController;

  private priceManager: PriceController;

  readonly validator: Validators;

  public vaultFactory = new VaultFactory({
    engine: this,
  });

  constructor() {
    this.dbApi = new DbApi() as DBAPI;
    this.priceManager = new PriceController();
    this.providerManager = new ProviderController((networkId) =>
      this.dbApi
        .getNetwork(networkId)
        .then((dbNetwork) => fromDBNetworkToChainInfo(dbNetwork)),
    );
    this.validator = new Validators(this);
  }

  async syncPresetNetworks(): Promise<void> {
    await syncLatestNetworkList();

    try {
      const defaultNetworkList: Array<[string, boolean]> = [];
      const dbNetworks = await this.dbApi.listNetworks();
      const dbNetworkMap = Object.fromEntries(
        dbNetworks.map((dbNetwork) => [dbNetwork.id, dbNetwork.enabled]),
      );

      const presetNetworksList = Object.values(getPresetNetworks()).sort(
        (a, b) => {
          const aPosition =
            (a.extensions || {}).position || Number.MAX_SAFE_INTEGER;
          const bPosition =
            (b.extensions || {}).position || Number.MAX_SAFE_INTEGER;
          if (aPosition > bPosition) {
            return 1;
          }
          if (aPosition < bPosition) {
            return -1;
          }
          return a.name > b.name ? 1 : -1;
        },
      );

      for (const network of presetNetworksList) {
        if (getSupportedImpls().has(network.impl)) {
          const existingStatus = dbNetworkMap[network.id];
          if (typeof existingStatus !== 'undefined') {
            defaultNetworkList.push([network.id, existingStatus]);
          } else {
            await this.dbApi.addNetwork({
              id: network.id,
              name: network.name,
              impl: network.impl,
              symbol: network.symbol,
              logoURI: network.logoURI,
              enabled: network.enabled,
              feeSymbol: network.feeSymbol,
              decimals: network.decimals,
              feeDecimals: network.feeDecimals,
              balance2FeeDecimals: network.balance2FeeDecimals,
              rpcURL: network.presetRpcURLs[0],
              position: 0,
            });
            dbNetworkMap[network.id] = network.enabled;
            defaultNetworkList.push([network.id, network.enabled]);
          }
        }
      }

      // add default token in background
      this.addDefaultToken();

      const context = await this.dbApi.getContext();
      if (
        typeof context !== 'undefined' &&
        context.networkOrderChanged === true
      ) {
        return;
      }
      const specifiedNetworks = new Set(defaultNetworkList.map(([id]) => id));
      dbNetworks.forEach((dbNetwork) => {
        if (!specifiedNetworks.has(dbNetwork.id)) {
          defaultNetworkList.push([dbNetwork.id, dbNetwork.enabled]);
        }
      });
      await this.dbApi.updateNetworkList(defaultNetworkList, true);
    } catch (error) {
      console.error(error);
    }
  }

  @backgroundMethod()
  generateMnemonic(): Promise<string> {
    return Promise.resolve(bip39.generateMnemonic());
  }

  @backgroundMethod()
  mnemonicToEntropy(mnemonic: string): Promise<string> {
    const wordlists = bip39.wordlists.english;
    const n = wordlists.length;
    const words = mnemonic.split(' ');
    let i = new BigNumber(0);
    while (words.length) {
      const w = words.pop();
      if (w) {
        const k = wordlists.indexOf(w);
        i = i.times(n).plus(k);
      }
    }
    return Promise.resolve(i.toFixed());
  }

  @backgroundMethod()
  entropyToMnemonic(entropy: string): Promise<string> {
    const wordlists = bip39.wordlists.english;
    const n = wordlists.length;

    const mnemonic = [];
    let ent = new BigNumber(entropy);
    let x = 0;
    while (ent.gt(0)) {
      x = ent.mod(n).integerValue().toNumber();
      ent = ent.idiv(n);

      mnemonic.push(wordlists[x]);
    }

    // v1 fix
    let fixFillCount = 0;
    if (mnemonic.length < 12) {
      fixFillCount = 12 - mnemonic.length;
    } else if (mnemonic.length > 12 && mnemonic.length < 18) {
      fixFillCount = 18 - mnemonic.length;
    } else if (mnemonic.length > 18 && mnemonic.length < 24) {
      fixFillCount = 24 - mnemonic.length;
    }

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < fixFillCount; i++) {
      mnemonic.push(wordlists[0]);
    }

    return Promise.resolve(mnemonic.join(' '));
  }

  @backgroundMethod()
  mnemonicToEntropyV2(mnemonic: string): Promise<string> {
    return Promise.resolve(
      bip39.mnemonicToEntropy(mnemonic, bip39.wordlists.english),
    );
  }

  @backgroundMethod()
  entropyToMnemonicV2(entropy: string): Promise<string> {
    return Promise.resolve(
      bip39.entropyToMnemonic(entropy, bip39.wordlists.english),
    );
  }

  @backgroundMethod()
  async getWallets(): Promise<Array<Wallet>> {
    // Return all wallets, including the special imported wallet and watching wallet.
    const wallets = await this.dbApi.getWallets();
    return wallets.sort((a, b) =>
      natsort({ insensitive: true })(a.name, b.name),
    );
  }

  @backgroundMethod()
  async getWallet(walletId: string): Promise<Wallet> {
    // Return a single wallet.
    const wallet = await this.dbApi.getWallet(walletId);
    if (typeof wallet !== 'undefined') {
      return wallet;
    }
    throw new OneKeyInternalError(`Wallet ${walletId} not found.`);
  }

  @backgroundMethod()
  async getWalletByDeviceId(deviceId: string): Promise<Wallet> {
    const wallet = await this.dbApi.getWalletByDeviceId(deviceId);
    if (typeof wallet !== 'undefined') {
      return wallet;
    }
    throw new OneKeyInternalError(
      `Wallet with device id ${deviceId} not found.`,
    );
  }

  @backgroundMethod()
  async createHDWallet({
    password,
    mnemonic,
    name,
    avatar,
  }: {
    password: string;
    mnemonic?: string;
    name?: string;
    avatar?: Avatar;
  }): Promise<Wallet> {
    // Create an HD wallet, generate seed if not provided.
    if (typeof name !== 'undefined' && name.length > 0) {
      await this.validator.validateWalletName(name);
    }
    await this.validator.validatePasswordStrength(password);

    const [usedMnemonic] = await Promise.all([
      this.validator.validateMnemonic(mnemonic || bip39.generateMnemonic()),
      this.validator.validateHDWalletNumber(),
    ]);

    let rs;
    try {
      rs = revealableSeedFromMnemonic(usedMnemonic, password);
    } catch {
      throw new OneKeyInternalError('Invalid mnemonic.');
    }

    if (
      usedMnemonic === mnemonicFromEntropy(rs.entropyWithLangPrefixed, password)
    ) {
      const wallet = await this.dbApi.createHDWallet({
        password,
        rs,
        backuped: typeof mnemonic !== 'undefined',
        name,
        avatar,
      });

      const supportedImpls = getSupportedImpls();
      const addedImpl = new Set();
      const networks: Array<string> = [];
      (await this.listNetworks()).forEach(({ id: networkId, impl }) => {
        if (supportedImpls.has(impl) && !addedImpl.has(impl)) {
          addedImpl.add(impl);
          networks.push(networkId);
        }
      });
      await Promise.all(
        networks.map((networkId) =>
          this.addHdOrHwAccounts(password, wallet.id, networkId).then(
            undefined,
            (e) => console.error(e),
          ),
        ),
      );

      return this.dbApi.confirmWalletCreated(wallet.id);
    }

    throw new OneKeyInternalError('Invalid mnemonic.');
  }

  @backgroundMethod()
  async createHWWallet({
    name,
    avatar,
    features,
    connectId,
  }: {
    name?: string;
    avatar?: Avatar;
    features: IOneKeyDeviceFeatures;
    connectId: string;
  }): Promise<Wallet> {
    if (typeof name !== 'undefined' && name.length > 0) {
      await this.validator.validateWalletName(name);
    }
    await this.validator.validateHWWalletNumber();

    if (!features.initialized) {
      throw new OneKeyHardwareError({
        message: 'Hardware wallet not initialized.',
      });
    }
    const id = generateUUID();
    const serialNo = features.onekey_serial ?? features.serial_no ?? '';
    if (id.length === 0) {
      throw new OneKeyInternalError('Bad device identity.');
    }
    const deviceId = features.device_id ?? '';
    const deviceType = getDeviceType(features);
    const deviceUUID = getDeviceUUID(features);
    const walletName =
      name ??
      features.label ??
      features.ble_name ??
      `OneKey ${serialNo.slice(-4)}`;
    const wallet = await this.dbApi.addHWWallet({
      id,
      name: walletName,
      avatar,
      deviceId,
      deviceType,
      deviceUUID,
      connectId,
      features: JSON.stringify(features),
    });
    // Add BTC & ETH accounts by default.
    try {
      await this.addHdOrHwAccounts('', wallet.id, 'btc--0');
      await this.addHdOrHwAccounts('', wallet.id, 'evm--1');
    } catch (e) {
      await this.removeWallet(wallet.id, '');
      if (e instanceof OneKeyHardwareError) throw e;
      throw new OneKeyInternalError('Failed to create HW Wallet.');
    }
    return this.getWallet(wallet.id);
  }

  @backgroundMethod()
  updateWalletName(walletId: string, name: string) {
    return this.dbApi.updateWalletName(walletId, name);
  }

  @backgroundMethod()
  async getHWDevices() {
    return this.dbApi.getDevices();
  }

  @backgroundMethod()
  async getHWDeviceByWalletId(walletId: string) {
    const wallet = await this.dbApi.getWallet(walletId);
    if (wallet?.associatedDevice) {
      const device = await this.dbApi.getDevice(wallet.associatedDevice);
      return device;
    }

    return null;
  }

  @backgroundMethod()
  async getHWDeviceByDeviceId(deviceId: string) {
    return this.dbApi.getDeviceByDeviceId(deviceId);
  }

  @backgroundMethod()
  async updateDevicePayload(deviceId: string, payload: DevicePayload) {
    return this.dbApi.updateDevicePayload(deviceId, payload);
  }

  @backgroundMethod()
  removeWallet(walletId: string, password: string): Promise<void> {
    // Remove a wallet, raise an error if trying to remove the imported or watching wallet.
    if (!walletCanBeRemoved(walletId)) {
      throw new OneKeyInternalError(`Wallet ${walletId} cannot be removed.`);
    }
    return this.dbApi.removeWallet(walletId, password);
  }

  @backgroundMethod()
  async setWalletNameAndAvatar(
    walletId: string,
    { name, avatar }: { name?: string; avatar?: Avatar },
  ): Promise<Wallet> {
    // Rename a wallet, raise an error if trying to rename the imported or watching wallet.
    if (typeof name !== 'undefined') {
      await this.validator.validateWalletName(name);
    }
    return this.dbApi.setWalletNameAndAvatar(walletId, { name, avatar });
  }

  @backgroundMethod()
  async revealHDWalletMnemonic(
    walletId: string,
    password: string,
  ): Promise<string> {
    // Reveal the wallet seed, raise an error if wallet isn't HD, doesn't exist or password is wrong.
    if (!walletIsHD(walletId)) {
      throw new OneKeyInternalError(`Wallet ${walletId} is not an HD wallet.`);
    }
    const credential = (await this.dbApi.getCredential(
      walletId,
      password,
    )) as ExportedSeedCredential;
    return mnemonicFromEntropy(credential.entropy, password);
  }

  @backgroundMethod()
  confirmHDWalletBackuped(walletId: string): Promise<Wallet> {
    // Confirm that the wallet seed is backed up. Raise an error if wallet isn't HD, doesn't exist. Nothing happens if the wallet is already backed up before this call.
    if (!walletIsHD(walletId)) {
      throw new OneKeyInternalError(`Wallet ${walletId} is not an HD wallet.`);
    }
    return this.dbApi.confirmHDWalletBackuped(walletId);
  }

  @backgroundMethod()
  async getWalletAccountsGroupedByNetwork(
    walletId: string,
  ): Promise<Array<{ networkId: string; accounts: Array<Account> }>> {
    const wallet = await this.getWallet(walletId);
    const accounts = await this.getAccounts(wallet.accounts);
    const networks = await this.listNetworks();

    const networkToAccounts: Record<string, Array<Account>> = {};
    const coinTypeToNetworks: Record<string, Array<string>> = {};
    for (const network of networks) {
      networkToAccounts[network.id] = [];
      const coinType = implToCoinTypes[network.impl];
      if (coinType in coinTypeToNetworks) {
        coinTypeToNetworks[coinType].push(network.id);
      } else {
        coinTypeToNetworks[coinType] = [network.id];
      }
    }

    for (const account of accounts) {
      for (const networkId of coinTypeToNetworks[account.coinType] || []) {
        if (account.type !== AccountType.VARIANT) {
          networkToAccounts[networkId].push(account);
        } else {
          const vault = await this.getVault({
            networkId,
            accountId: account.id,
          });
          networkToAccounts[networkId].push(await vault.getOutputAccount());
        }
      }
    }
    return networks.map(({ id: networkId }) => ({
      networkId,
      accounts: networkToAccounts[networkId],
    }));
  }

  @backgroundMethod()
  async getAccounts(
    accountIds: Array<string>,
    networkId?: string,
  ): Promise<Array<Account>> {
    // List accounts by account ids. No token info are returned, only base account info are included.
    if (accountIds.length === 0) {
      return [];
    }

    const accounts = await this.dbApi.getAccounts(accountIds);
    return Promise.all(
      accounts
        .filter(
          (a) =>
            typeof networkId === 'undefined' ||
            isAccountCompatibleWithNetwork(a.id, networkId),
        )
        .sort((a, b) => natsort({ insensitive: true })(a.name, b.name))
        .map((a: DBAccount) =>
          typeof networkId === 'undefined'
            ? {
                id: a.id,
                name: a.name,
                type: a.type,
                path: a.path,
                coinType: a.coinType,
                tokens: [],
                address: a.address,
              }
            : this.getVault({ accountId: a.id, networkId }).then((vault) =>
                vault.getOutputAccount(),
              ),
        ),
    );
  }

  @backgroundMethod()
  async getAccount(accountId: string, networkId: string): Promise<Account> {
    // Get account by id. Raise an error if account doesn't exist.
    // Token ids are included.
    const vault = await this.getVault({ accountId, networkId });
    return vault.getOutputAccount();
  }

  @backgroundMethod()
  async getHWAddress(accountId: string, networkId: string, walletId: string) {
    const vault = await this.getVault({ accountId, networkId });
    const { path } = await this.dbApi.getAccount(accountId);
    const device = await this.getHWDeviceByWalletId(walletId);
    if (!device) {
      throw new OneKeyInternalError(`Device not found.`);
    }

    try {
      const address = await vault.keyring.getAddress({
        path,
        showOnOneKey: true,
      });

      if (!address) {
        throw new OneKeyInternalError(`Address not found.`);
      }
      return address;
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

  @backgroundMethod()
  async getAccountPrivateKey(
    accountId: string,
    password: string,
    // networkId?: string, TODO: different curves on different networks.
  ): Promise<string> {
    const { coinType } = await this.dbApi.getAccount(accountId);
    // TODO: need a method to get default network from coinType.
    const networkId = {
      '60': 'evm--1',
      '503': 'cfx--1029',
      '397': 'near--0',
      '0': 'btc--0',
      '101010': 'stc--1',
    }[coinType];
    if (typeof networkId === 'undefined') {
      throw new NotImplemented('Unsupported network.');
    }

    const vault = await this.getVault({ accountId, networkId });
    return vault.getExportedCredential(password);
  }

  @backgroundMethod()
  async getAccountBalance(
    accountId: string,
    networkId: string,
    tokenIdsOnNetwork: Array<string>,
    withMain = true,
  ): Promise<Record<string, string | undefined>> {
    // Get account balance, main token balance is always included.
    const [network, tokens] = await Promise.all([
      this.getNetwork(networkId),
      this.getTokens(networkId, undefined, false),
    ]);
    const decimalsMap: Record<string, number> = {};
    tokens.forEach((token) => {
      if (tokenIdsOnNetwork.includes(token.tokenIdOnNetwork)) {
        decimalsMap[token.tokenIdOnNetwork] = token.decimals;
      }
    });
    const tokensToGet = tokenIdsOnNetwork.filter(
      (tokenId) => typeof decimalsMap[tokenId] !== 'undefined',
    );
    const vault = await this.getVault({ networkId, accountId });
    const balances = await vault.getAccountBalance(tokensToGet, withMain);
    const ret: Record<string, string | undefined> = {};
    if (withMain) {
      if (typeof balances[0] !== 'undefined') {
        ret.main = balances[0]
          .div(new BigNumber(10).pow(network.decimals))
          .toFixed();
      } else {
        ret.main = undefined;
      }
    }
    balances.slice(withMain ? 1 : 0).forEach((balance, index) => {
      const tokenId1 = tokensToGet[index];
      const decimals = decimalsMap[tokenId1];
      if (typeof balance !== 'undefined') {
        ret[tokenId1] = balance.div(new BigNumber(10).pow(decimals)).toFixed();
      }
    });
    return ret;
  }

  @backgroundMethod()
  async searchHDAccounts(
    walletId: string,
    networkId: string,
    password: string,
    start = 0,
    limit = 10,
    purpose?: number,
  ): Promise<Array<ImportableHDAccount>> {
    // Search importable HD accounts.
    const [wallet, dbNetwork] = await Promise.all([
      this.dbApi.getWallet(walletId),
      this.dbApi.getNetwork(networkId),
    ]);
    if (typeof wallet === 'undefined') {
      throw new OneKeyInternalError(`Wallet ${walletId} not found.`);
    }

    const indexes = Array.from(Array(limit).keys())
      .map((index) => start + index)
      .filter((i) => i < 2 ** 31);

    const vault = await this.getWalletOnlyVault(networkId, walletId);
    const accounts = await vault.keyring.prepareAccounts({
      type: 'SEARCH_ACCOUNTS',
      password,
      indexes,
      purpose,
    });

    const addresses = accounts.map((a) => {
      if (a.type === AccountType.UTXO) {
        // TODO: utxo should use xpub instead of its first address
        return (a as DBUTXOAccount).address;
      }
      if (a.type === AccountType.VARIANT) {
        return (a as DBVariantAccount).addresses[networkId];
      }
      return a.address;
    });
    // TODO: balance is not display when searching now
    const balances: Array<BigNumber | undefined> = addresses.map(
      () => undefined,
    );
    return balances.map((balance, index) => ({
      index: start + index,
      path: accounts[index].path,
      defaultName: accounts[index].name,
      displayAddress: addresses[index],
      mainBalance:
        typeof balance === 'undefined'
          ? '0'
          : balance.div(new BigNumber(10).pow(dbNetwork.decimals)).toFixed(),
    }));
  }

  @backgroundMethod()
  async addHdOrHwAccounts(
    password: string,
    walletId: string,
    networkId: string,
    indexes?: Array<number>,
    names?: Array<string>,
    purpose?: number,
    callback = (_account: Account): Promise<boolean> => Promise.resolve(true),
  ): Promise<Array<Account>> {
    // And an HD account to wallet. Path and name are auto detected if not specified.
    // Raise an error if:
    // 1. wallet,
    //   a. doesn't exist,
    //   b. is not an HD account;
    // 2. password is wrong;
    // 3. account already exists;
    if (Array.isArray(names)) {
      await this.validator.validateAccountNames(names);
    }
    const [wallet, dbNetwork] = await Promise.all([
      this.dbApi.getWallet(walletId),
      this.dbApi.getNetwork(networkId),
    ]);
    if (typeof wallet === 'undefined') {
      throw new OneKeyInternalError(`Wallet ${walletId} not found.`);
    }

    const { impl } = dbNetwork;
    const usedPurpose = purpose || getDefaultPurpose(impl);
    const usedIndexes = indexes || [
      wallet.nextAccountIds[`${usedPurpose}'/${implToCoinTypes[impl]}'`] || 0,
    ];
    if (usedIndexes.some((index) => index >= 2 ** 31)) {
      throw new OneKeyInternalError(
        'Invalid child index, should be less than 2^31.',
      );
    }

    const vault = await this.getWalletOnlyVault(networkId, walletId);
    const accounts = await vault.keyring.prepareAccounts({
      type: 'ADD_ACCOUNTS',
      password,
      indexes: usedIndexes,
      purpose: usedPurpose,
      names,
    });

    const ret: Array<Account> = [];
    for (const dbAccount of accounts) {
      const { id } = await this.dbApi.addAccountToWallet(walletId, dbAccount);

      await this.addDefaultToken(id, impl);

      const account = await this.getAccount(id, networkId);
      ret.push(account);
      if ((await callback(account)) === false) {
        break;
      }
    }
    return ret;
  }

  @backgroundMethod()
  async addImportedAccount(
    password: string,
    networkId: string,
    credential: string,
    name?: string,
  ): Promise<Account> {
    await this.validator.validatePasswordStrength(password);
    const impl = getImplFromNetworkId(networkId);
    let privateKey: Buffer | undefined;
    // TODO: use vault to extract private key.
    try {
      switch (impl) {
        case IMPL_BTC:
          privateKey = bs58check.decode(credential);
          break;
        case IMPL_NEAR: {
          const [prefix, encoded] = credential.split(':');
          const decodedPrivateKey = Buffer.from(baseDecode(encoded));
          if (prefix === 'ed25519' && decodedPrivateKey.length === 64) {
            privateKey = decodedPrivateKey.slice(0, 32);
          }
          break;
        }
        default:
          privateKey = Buffer.from(
            credential.startsWith('0x') ? credential.slice(2) : credential,
            'hex',
          );
      }
    } catch (e) {
      console.error(e);
    }
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Invalid credential to import.');
    }

    const encryptedPrivateKey = encrypt(password, privateKey);
    const vault = await this.getWalletOnlyVault(networkId, 'imported');
    const [dbAccount] = await vault.keyring.prepareAccounts({
      privateKey,
      name: name || '',
    });

    await this.dbApi.addAccountToWallet('imported', dbAccount, {
      type: CredentialType.PRIVATE_KEY,
      privateKey: encryptedPrivateKey,
      password,
    });

    await this.addDefaultToken(dbAccount.id, impl);

    return this.getAccount(dbAccount.id, networkId);
  }

  @backgroundMethod()
  async addWatchingAccount(
    networkId: string,
    target: string,
    name: string,
  ): Promise<Account> {
    // throw new Error('sample test error');
    // Add an watching account. Raise an error if account already exists.
    // TODO: now only adding by address is supported.
    await this.validator.validateAccountNames([name]);

    const impl = getImplFromNetworkId(networkId);
    const vault = await this.getWalletOnlyVault(networkId, 'watching');
    const [dbAccount] = await vault.keyring.prepareAccounts({
      target,
      name,
    });

    const a = await this.dbApi.addAccountToWallet('watching', dbAccount);

    await this.addDefaultToken(a.id, impl);

    return this.getAccount(a.id, networkId);
  }

  @backgroundMethod()
  async removeAccount(accountId: string, password: string): Promise<void> {
    // Remove an account. Raise an error if account doesn't exist or password is wrong.
    const walletId = getWalletIdFromAccountId(accountId);
    const [wallet, dbAccount] = await Promise.all([
      this.getWallet(walletId),
      this.dbApi.getAccount(accountId),
    ]);
    let rollbackNextAccountIds: Record<string, number> = {};

    if (dbAccount.coinType === COINTYPE_BTC && dbAccount.path.length > 0) {
      const components = dbAccount.path.split('/');
      const nextAccountCategory = `${components[1]}/${components[2]}`;
      const index = parseInt(components[3].slice(0, -1)); // remove the "'" suffix
      if (wallet.nextAccountIds[nextAccountCategory] === index + 1) {
        // Removing the last account, may need to roll back next account id.
        rollbackNextAccountIds = { [nextAccountCategory]: index };
        try {
          const vault = await this.getChainOnlyVault('btc--0');
          const accountUsed = await vault.checkAccountExistence(
            (dbAccount as DBUTXOAccount).xpub,
          );
          if (accountUsed) {
            // The account being deleted is used, no need to rollback.
            rollbackNextAccountIds = {};
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    return this.dbApi.removeAccount(
      getWalletIdFromAccountId(accountId),
      accountId,
      password,
      rollbackNextAccountIds,
    );
  }

  @backgroundMethod()
  async setAccountName(accountId: string, name: string): Promise<Account> {
    // Rename an account. Raise an error if account doesn't exist.
    // Nothing happens if name is not changed.
    await this.validator.validateAccountNames([name]);
    const dbAccount = await this.dbApi.setAccountName(accountId, name);
    return {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.address,
    };
  }

  @backgroundMethod()
  public async isTokenExistsInDb({
    networkId,
    tokenIdOnNetwork,
  }: {
    networkId: string;
    tokenIdOnNetwork: string;
  }) {
    const tokenId = `${networkId}--${tokenIdOnNetwork}`;
    const token = await this.dbApi.getToken(tokenId);
    return !!token;
  }

  findToken = memoizee(
    async (params: { networkId: string; tokenIdOnNetwork: string }) => {
      const { networkId, tokenIdOnNetwork } = params;
      if (!tokenIdOnNetwork) {
        return this.getNativeTokenInfo(networkId);
      }

      const tokenId = `${networkId}--${tokenIdOnNetwork}`;
      const token = await this.dbApi.getToken(tokenId);
      if (typeof token !== 'undefined') {
        // Already exists in db.
        return token;
      }

      const presetToken = getPresetToken(networkId, tokenIdOnNetwork);
      if (typeof presetToken !== 'undefined') {
        // Loose mode for history parsing, use only preset info, don't need to
        // strictly fetch token info from blockchain.
        return { ...presetToken, id: tokenId };
      }

      // Token is not preset, get its info from blockchain.
      const vault = await this.getChainOnlyVault(networkId);
      let tokenInfo;
      try {
        [tokenInfo] = await vault.fetchTokenInfos([tokenIdOnNetwork]);
      } catch (e) {
        console.error(e);
      }
      if (typeof tokenInfo === 'undefined') {
        return;
      }
      return {
        id: tokenId,
        name: tokenInfo.name,
        networkId,
        tokenIdOnNetwork,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        logoURI: '',
      };
    },
    {
      promise: true,
      primitive: true,
      max: 200,
      maxAge: 1000 * 60 * 10,
      normalizer: (args) => JSON.stringify(args),
    },
  );

  @backgroundMethod()
  public async ensureTokenInDB(
    networkId: string,
    tokenIdOnNetwork: string,
  ): Promise<Token | undefined> {
    // This method ensures token info is correctly added into DB.
    if (!tokenIdOnNetwork) {
      return this.getNativeTokenInfo(networkId);
    }

    const tokenId = `${networkId}--${tokenIdOnNetwork}`;
    const token = await this.dbApi.getToken(tokenId);
    if (typeof token !== 'undefined') {
      // Already exists in db.
      return token;
    }

    const presetToken = getPresetToken(networkId, tokenIdOnNetwork);
    const vault = await this.getChainOnlyVault(networkId);
    let tokenInfo;
    try {
      [tokenInfo] = await vault.fetchTokenInfos([tokenIdOnNetwork]);
    } catch (e) {
      console.error(e);
    }
    if (typeof tokenInfo === 'undefined') {
      return;
    }

    // If the token is not preset or it is not on solana, use the name and
    // symbol retrieved from the network.
    const useOnChainInfo =
      typeof presetToken === 'undefined' ||
      getImplFromNetworkId(networkId) !== IMPL_SOL;

    return this.dbApi.addToken({
      // Default values
      logoURI: '',
      networkId,
      tokenIdOnNetwork,
      // Override with preset if any
      ...presetToken,
      // Override with on-chain info
      ...(useOnChainInfo
        ? {
            name: tokenInfo.name,
            symbol: tokenInfo.symbol,
          }
        : {}),
      // Important properties
      id: tokenId,
      decimals: tokenInfo.decimals,
    } as Token);
  }

  private async addDefaultToken(
    accountId?: string,
    impl?: string,
  ): Promise<void> {
    const tokens = getDefaultStableTokens();

    let networkIds: string[] = Object.keys(tokens).filter((v) =>
      getSupportedImpls().has(getImplFromNetworkId(v)),
    );
    if (accountId && impl) {
      // filter for account
      networkIds = networkIds.filter((v) => getImplFromNetworkId(v) === impl);
    }
    await Promise.all(
      networkIds.reduce(
        (waitingList: Array<Promise<void>>, networkId) =>
          waitingList.concat(
            tokens[networkId].map(async (tokenIdOnNetwork) => {
              try {
                const token = await this.ensureTokenInDB(
                  networkId,
                  tokenIdOnNetwork,
                );
                if (typeof token === 'undefined') {
                  console.error('Token not added', networkId, tokenIdOnNetwork);
                } else if (accountId && impl) {
                  await this.addTokenToAccount(accountId, token.id);
                }
              } catch (e) {
                console.error(e);
              }
            }),
          ),
        [],
      ),
    );
  }

  @backgroundMethod()
  addTokenToAccount(accountId: string, tokenId: string): Promise<Token> {
    // Add an token to account.
    if (
      !isAccountCompatibleWithNetwork(
        accountId,
        getNetworkIdFromTokenId(tokenId),
      )
    ) {
      throw new OneKeyInternalError(
        `Cannot add token ${tokenId} to account ${accountId}: incompatible.`,
      );
    }
    return this.dbApi.addTokenToAccount(accountId, tokenId);
  }

  @backgroundMethod()
  async quickAddToken(
    accountId: string,
    networkId: string,
    tokenIdOnNetwork: string,
  ): Promise<Token | undefined> {
    let ret: Token | undefined;
    const preResult = await this.preAddToken(
      accountId,
      networkId,
      tokenIdOnNetwork,
      false,
    );
    if (typeof preResult !== 'undefined') {
      ret = await this.addTokenToAccount(accountId, preResult[1].id);
    }
    return ret;
  }

  @backgroundMethod()
  removeTokenFromAccount(accountId: string, tokenId: string): Promise<void> {
    // Remove token from an account.
    return this.dbApi.removeTokenFromAccount(accountId, tokenId);
  }

  @backgroundMethod()
  async preAddToken(
    accountId: string,
    networkId: string,
    tokenIdOnNetwork: string,
    withBalance = true,
  ): Promise<[string | undefined, Token] | undefined> {
    // 1. find local token
    // 2. if not, find token online
    // 3. get token balance
    // 4. return
    // TODO: logoURI?
    const normalizedAddress = await this.validator.validateTokenAddress(
      networkId,
      tokenIdOnNetwork,
    );
    if (!isAccountCompatibleWithNetwork(accountId, networkId)) {
      throw new OneKeyInternalError(
        `account ${accountId} and network ${networkId} isn't compatible.`,
      );
    }
    const token = await this.ensureTokenInDB(networkId, normalizedAddress);
    if (typeof token === 'undefined') {
      return undefined;
    }
    if (!withBalance) {
      return [undefined, token];
    }

    const vault = await this.getVault({ networkId, accountId });
    const [balance] = await vault.getAccountBalance([normalizedAddress], false);
    if (typeof balance === 'undefined') {
      return undefined;
    }
    return [
      balance.div(new BigNumber(10).pow(token.decimals)).toFixed(),
      token,
    ];
  }

  async getNativeTokenInfo(networkId: string) {
    const dbNetwork = await this.dbApi.getNetwork(networkId);

    return {
      id: dbNetwork.id,
      name: dbNetwork.symbol,
      networkId,
      tokenIdOnNetwork: '',
      symbol: dbNetwork.symbol,
      decimals: dbNetwork.decimals,
      logoURI: dbNetwork.logoURI,
    };
  }

  @backgroundMethod()
  async getTokens(
    networkId: string,
    accountId?: string,
    withMain = true,
  ): Promise<Array<Token>> {
    // Get token info by network and account.
    const tokens = await this.dbApi.getTokens(networkId, accountId);
    if (typeof accountId !== 'undefined') {
      if (withMain) {
        const nativeToken = await this.getNativeTokenInfo(networkId);
        tokens.unshift(nativeToken);
      }
      return tokens;
    }
    const existingTokens = new Set(
      tokens.map((token: Token) => token.tokenIdOnNetwork),
    );
    return tokens.concat(
      getPresetTokensOnNetwork(networkId).filter(
        (token1: Token) => !existingTokens.has(token1.tokenIdOnNetwork),
      ),
    );
  }

  @backgroundMethod()
  async getTopTokensOnNetwork(
    networkId: string,
    limit = 50,
  ): Promise<Array<Token>> {
    return Promise.resolve(getPresetTokensOnNetwork(networkId).slice(0, limit));
  }

  @backgroundMethod()
  async searchTokens(
    networkId: string,
    searchTerm: string,
  ): Promise<Array<Token>> {
    if (searchTerm.length === 0) {
      return [];
    }

    const { displayAddress, normalizedAddress, isValid } =
      await this.providerManager.verifyTokenAddress(networkId, searchTerm);

    if (
      isValid &&
      typeof displayAddress !== 'undefined' &&
      typeof normalizedAddress !== 'undefined'
    ) {
      // valid token address, return the specific token.
      let token = await this.dbApi.getToken(
        `${networkId}--${normalizedAddress}`,
      );
      const addressesToTry = new Set([normalizedAddress, displayAddress]);
      addressesToTry.forEach((address) => {
        if (typeof token === 'undefined') {
          const presetToken = getPresetToken(networkId, address);
          if (typeof presetToken !== 'undefined') {
            token = presetToken;
          }
        }
      });
      return typeof token !== 'undefined' ? [token] : [];
    }
    const matchPattern = new RegExp(searchTerm, 'i');
    const tokens = await this.getTokens(networkId);
    return tokens.filter(
      (token) =>
        token.name.match(matchPattern) || token.symbol.match(matchPattern),
    );
  }

  @backgroundMethod()
  async getTokenAllowance({
    networkId,
    accountId,
    tokenIdOnNetwork,
    spender,
  }: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork: string;
    spender: string;
  }): Promise<string | undefined> {
    // TODO: move this into vaults to support multichain
    try {
      if (!isAccountCompatibleWithNetwork(accountId, networkId)) {
        // Bad request, shouldn't happen.
        return;
      }
      const [tokenAddress, spenderAddress] = await Promise.all([
        this.validator.validateTokenAddress(networkId, tokenIdOnNetwork),
        this.validator.validateAddress(networkId, spender),
      ]);

      const vault = await this.getVault({ accountId, networkId });
      const allowance = await vault.getTokenAllowance(
        tokenAddress,
        spenderAddress,
      );
      if (!allowance.isNaN()) {
        return allowance.toFixed();
      }
    } catch (e) {
      console.error(e);
    }
  }

  @backgroundMethod()
  async signMessage({
    unsignedMessage,
    password,
    networkId,
    accountId,
  }: {
    unsignedMessage?: IUnsignedMessageEvm;
    password: string;
    networkId: string;
    accountId: string;
  }) {
    const vault = await this.getVault({
      accountId,
      networkId,
    });
    const [signedMessage] = await vault.keyring.signMessage([unsignedMessage], {
      password,
    });
    return signedMessage;
  }

  @backgroundMethod()
  async signAndSendEncodedTx({
    encodedTx,
    password,
    networkId,
    accountId,
  }: {
    encodedTx: any;
    password: string;
    networkId: string;
    accountId: string;
  }) {
    const vault = await this.getVault({
      accountId,
      networkId,
    });
    const unsignedTx = await vault.buildUnsignedTxFromEncodedTx(encodedTx);

    return vault.signAndSendTransaction(unsignedTx, {
      password,
    });
  }

  @backgroundMethod()
  async fetchFeeInfo({
    networkId,
    accountId,
    encodedTx,
  }: {
    networkId: string;
    accountId: string;
    encodedTx: any;
  }) {
    const vault = await this.getVault({ networkId, accountId });
    // throw new Error('test fetch fee info error');
    // TODO move to vault.fetchFeeInfo and _fetchFeeInfo
    // clone encodedTx to avoid side effects
    return vault.fetchFeeInfo(cloneDeep(encodedTx));
  }

  @backgroundMethod()
  async buildEncodedTxFromApprove({
    networkId,
    accountId,
    token,
    spender,
    amount,
  }: {
    networkId: string;
    accountId: string;
    token: string;
    amount: string;
    spender: string;
  }) {
    const vault = await this.getVault({ networkId, accountId });
    const { address } = await this.getAccount(accountId, networkId);
    return vault.buildEncodedTxFromApprove({
      token,
      spender,
      amount,
      from: address,
    });
  }

  @backgroundMethod()
  async attachFeeInfoToEncodedTx(params: {
    networkId: string;
    accountId: string;
    encodedTx: IEncodedTx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    const { networkId, accountId } = params;
    const vault = await this.getVault({ networkId, accountId });
    const txWithFee: IEncodedTx = await vault.attachFeeInfoToEncodedTx(params);
    debugLogger.sendTx.info('attachFeeInfoToEncodedTx', txWithFee);
    return txWithFee;
  }

  @backgroundMethod()
  async decodeTx({
    networkId,
    accountId,
    encodedTx,
    payload,
    interactInfo,
  }: {
    networkId: string;
    accountId: string;
    encodedTx: IEncodedTx;
    payload?: any;
    interactInfo?: IDecodedTxInteractInfo;
  }): Promise<{
    decodedTxLegacy: IDecodedTxLegacy;
    decodedTx: IDecodedTx;
  }> {
    const vault = await this.getVault({ networkId, accountId });
    let decodedTx: IDecodedTx;
    let decodedTxLegacy: IDecodedTxLegacy;
    if ((await vault.getNetworkImpl()) === IMPL_EVM) {
      // @ts-ignore
      const vaultEvm = vault as VaultEvm;
      decodedTxLegacy = await vaultEvm.legacyDecodeTx(encodedTx);
      decodedTx = await vaultEvm.decodedTxLegacyToModern({
        decodedTxLegacy,
        encodedTx: encodedTx as IEncodedTxEvm,
        payload,
        interactInfo,
      });
    } else {
      decodedTx = await vault.decodeTx(encodedTx, payload);
      decodedTxLegacy = await vault.decodedTxToLegacy(decodedTx);
    }

    // decodedTxLegacy.payload = payload;
    decodedTx.payload = decodedTx.payload ?? payload;
    decodedTx = await vault.fixDecodedTx(decodedTx);
    return {
      decodedTx,
      decodedTxLegacy,
    };
  }

  @backgroundMethod()
  async updateEncodedTx({
    networkId,
    accountId,
    encodedTx,
    payload,
    options,
  }: {
    networkId: string;
    accountId: string;
    encodedTx: IEncodedTx;
    payload: any;
    options: IEncodedTxUpdateOptions;
  }) {
    const vault = await this.getVault({ networkId, accountId });
    return vault.updateEncodedTx(encodedTx, payload, options);
  }

  @backgroundMethod()
  async updateEncodedTxTokenApprove({
    networkId,
    accountId,
    encodedTx,
    amount,
  }: {
    networkId: string;
    accountId: string;
    encodedTx: IEncodedTx;
    amount: string;
  }) {
    const vault = await this.getVault({ networkId, accountId });
    return vault.updateEncodedTxTokenApprove(encodedTx, amount);
  }

  @backgroundMethod()
  async buildEncodedTxFromTransfer({
    networkId,
    accountId,
    transferInfo,
  }: {
    networkId: string;
    accountId: string;
    transferInfo: ITransferInfo;
  }) {
    const transferInfoNew = {
      ...transferInfo,
    };
    transferInfoNew.amount = transferInfoNew.amount || '0';
    // throw new Error('build encodedtx error test');
    const vault = await this.getVault({ networkId, accountId });
    const result = await vault.buildEncodedTxFromTransfer(transferInfoNew);
    debugLogger.sendTx.info(
      'buildEncodedTxFromTransfer: ',
      transferInfoNew,
      result,
      {
        networkId,
        accountId,
      },
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }

  @backgroundMethod()
  async getGasPrice(networkId: string): Promise<Array<string | EIP1559Fee>> {
    const ret = await this.providerManager.getGasPrice(networkId);
    if (ret.length > 0 && ret[0] instanceof BigNumber) {
      const { feeDecimals } = await this.dbApi.getNetwork(networkId);
      return (ret as Array<BigNumber>).map((price: BigNumber) =>
        price.shiftedBy(-feeDecimals).toFixed(),
      );
    }
    return ret as Array<EIP1559Fee>;
  }

  async getVault(options: { networkId: string; accountId: string }) {
    return this.vaultFactory.getVault(options);
  }

  async getChainOnlyVault(networkId: string) {
    return this.vaultFactory.getChainOnlyVault(networkId);
  }

  async getWalletOnlyVault(networkId: string, walletId: string) {
    return this.vaultFactory.getWalletOnlyVault(networkId, walletId);
  }

  getVaultSettings = memoizee(
    async (networkId: string) => {
      const vault = await this.getChainOnlyVault(networkId);
      return vault.settings;
    },
    {
      promise: true,
      primitive: true,
      max: 50,
      maxAge: 1000 * 60 * 60,
      normalizer: (args) => `${args[0]}`,
    },
  );

  @backgroundMethod()
  async addHistoryEntry({
    id,
    networkId,
    accountId,
    type,
    status,
    meta,
    payload,
  }: {
    id: string;
    networkId: string;
    accountId: string;
    type: HistoryEntryType;
    status: HistoryEntryStatus;
    meta: HistoryEntryMeta;
    payload?: SendConfirmPayload;
  }) {
    const network = await this.getNetwork(networkId);
    // TODO only save history on EVM
    if (network.impl !== IMPL_EVM) {
      return;
    }

    if ('rawTx' in meta && !meta.rawTxPreDecodeCache) {
      let rawTxPreDecoded: string | undefined;

      try {
        const vaultHelper = createVaultHelperInstance({
          networkId,
          accountId,
        });
        const nativeTx = await vaultHelper.parseToNativeTx(meta.rawTx);
        rawTxPreDecoded = await vaultHelper.nativeTxToJson(nativeTx);
      } catch (error) {
        console.error(error);
      }

      meta.rawTxPreDecodeCache = rawTxPreDecoded;

      if (payload && !meta.payload) {
        meta.payload = JSON.stringify(payload);
      }
    }

    await this.dbApi.addHistoryEntry(
      id,
      networkId,
      accountId,
      type,
      status,
      meta,
    );
  }

  async getHistory(
    networkId: string,
    accountId: string,
    contract?: string,
    updatePending = true,
    limit = 100,
    before?: number,
  ): Promise<Array<HistoryEntry>> {
    const entries = await this.dbApi.getHistory(
      limit,
      networkId,
      accountId,
      contract,
      before,
    );
    const vault = await this.getVault({
      accountId,
      networkId,
    });

    let updatedStatusMap: Record<string, HistoryEntryStatus> = {};
    if (updatePending) {
      updatedStatusMap = await vault.updatePendingTxs(entries);
    }

    return entries.map((entry) => {
      const updatedStatus = updatedStatusMap[entry.id];
      if (typeof updatedStatus !== 'undefined') {
        return Object.assign(entry, { status: updatedStatus });
      }
      return entry;
    });
  }

  removeHistoryEntry(entryId: string): Promise<void> {
    return this.dbApi.removeHistoryEntry(entryId);
  }

  @backgroundMethod()
  async listNetworks(enabledOnly = true): Promise<Array<Network>> {
    const networks = await this.dbApi.listNetworks();
    return Promise.all(
      networks
        .filter(
          (dbNetwork) =>
            (enabledOnly ? dbNetwork.enabled : true) &&
            getSupportedImpls().has(dbNetwork.impl),
        )
        .map(async (dbNetwork) => this.dbNetworkToNetwork(dbNetwork)),
    );
  }

  listEnabledNetworksGroupedByVault = memoizee(
    async () => {
      const networks = await this.listNetworks();
      return networks.reduce((r: Record<string, Array<Network>>, network) => {
        r[network.impl] = r[network.impl] || [];
        r[network.impl].push(network);
        return r;
      }, {});
    },
    {
      promise: true,
    },
  );

  async dbNetworkToNetwork(dbNetwork: DBNetwork) {
    const settings = await this.getVaultSettings(dbNetwork.id);
    const network = fromDBNetworkToNetwork(dbNetwork, settings);
    return network;
  }

  @backgroundMethod()
  async preAddNetwork(
    rpcURL: string,
    impl = IMPL_EVM,
  ): Promise<{ chainId: string; existingNetwork: Network | undefined }> {
    if (rpcURL.length === 0) {
      throw new OneKeyInternalError('Empty RPC URL.');
    }

    let chainId = '';
    let existingNetwork: Network | undefined;

    switch (impl) {
      case IMPL_EVM:
        chainId = await this.providerManager.getEVMChainId(rpcURL);
        try {
          existingNetwork = await this.getNetwork(`${IMPL_EVM}--${chainId}`);
        } catch (e) {
          console.debug(e);
        }
        break;
      default:
        throw new NotImplemented(
          `Adding network for implemetation ${impl} is not supported.`,
        );
    }

    return { chainId, existingNetwork };
  }

  @backgroundMethod()
  async getRPCEndpointStatus(
    rpcURL: string,
    networkId: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    if (rpcURL.length === 0) {
      throw new OneKeyInternalError('Empty RPC URL.');
    }

    const vault = await this.getChainOnlyVault(networkId);
    return vault.getClientEndpointStatus(rpcURL);
  }

  @backgroundMethod()
  async addNetwork(impl: string, params: AddNetworkParams): Promise<Network> {
    if (params.rpcURL === '') {
      throw new OneKeyInternalError(
        'addNetwork: empty value is not allowed for RPC URL.',
      );
    }
    if (params.explorerURL) {
      try {
        const u = new URL(params.explorerURL);
        params.explorerURL = u.toString();
      } catch (error) {
        console.error(error);
        throw new OneKeyInternalError('addNetwork invalid URL');
      }
    }

    let networkId: string | undefined;
    switch (impl) {
      case IMPL_EVM: {
        try {
          networkId = await this.providerManager.getEVMChainId(params.rpcURL);
        } catch (e) {
          console.error(e);
        }
        break;
      }
      default:
        throw new OneKeyInternalError(
          `addNetwork: unsupported implementation ${impl} specified`,
        );
    }
    if (typeof networkId === 'undefined') {
      throw new OneKeyInternalError('addNetwork: failed to get network id.');
    }
    const dbObj = await this.dbApi.addNetwork(
      getEVMNetworkToCreate(`${impl}--${networkId}`, params),
    );
    this.listEnabledNetworksGroupedByVault.clear();
    return this.dbNetworkToNetwork(dbObj);
  }

  @backgroundMethod()
  async getNetwork(networkId: string): Promise<Network> {
    const dbObj = await this.dbApi.getNetwork(networkId);
    // this.dbNetworkToNetwork(dbObj) may cause cycle calling
    return fromDBNetworkToNetwork(dbObj, {} as IVaultSettings);
  }

  @backgroundMethod()
  async updateNetworkList(
    networks: Array<[string, boolean]>,
  ): Promise<Array<Network>> {
    const networksInDB = await this.dbApi.listNetworks();
    const specifiedNetworks = new Set(networks.map(([id]) => id));
    networksInDB.forEach((dbNetwork) => {
      if (!specifiedNetworks.has(dbNetwork.id)) {
        networks.push([dbNetwork.id, dbNetwork.enabled]);
      }
    });
    await this.dbApi.updateNetworkList(networks);
    this.listEnabledNetworksGroupedByVault.clear();
    return this.listNetworks(false);
  }

  @backgroundMethod()
  async updateNetwork(
    networkId: string,
    params: UpdateNetworkParams,
  ): Promise<Network> {
    if (Object.keys(params).length === 0) {
      throw new OneKeyInternalError('updateNetwork: params is empty.');
    }
    if (params.explorerURL) {
      try {
        const u = new URL(params.explorerURL);
        params.explorerURL = u.toString();
      } catch (error) {
        console.error(error);
        throw new OneKeyInternalError('updateNetwork invalid URL');
      }
    }
    if (networkIsPreset(networkId)) {
      if (typeof params.name !== 'undefined') {
        throw new OneKeyInternalError(
          'Cannot update name of a preset network.',
        );
      }
      if (typeof params.symbol !== 'undefined') {
        throw new OneKeyInternalError(
          'Cannot update symbol of a preset network.',
        );
      }
    }
    // TODO: chain interaction to check rpc url works correctly.
    const dbObj = await this.dbApi.updateNetwork(networkId, params);
    return this.dbNetworkToNetwork(dbObj);
  }

  @backgroundMethod()
  async deleteNetwork(networkId: string): Promise<void> {
    if (networkIsPreset(networkId)) {
      throw new OneKeyInternalError('Preset network cannot be deleted.');
    }
    this.listEnabledNetworksGroupedByVault.clear();
    return this.dbApi.deleteNetwork(networkId);
  }

  @backgroundMethod()
  async getRPCEndpoints(
    networkId: string,
  ): Promise<{ urls: Array<string>; defaultRpcURL: string }> {
    // List preset/saved rpc endpoints of a network.
    const network = await this.dbApi.getNetwork(networkId);
    const presetNetworks = getPresetNetworks();
    const { presetRpcURLs } = presetNetworks[networkId] || {
      presetRpcURLs: [],
    };
    const defaultRpcURL = presetRpcURLs[0] || network.rpcURL;
    const urls = [network.rpcURL].concat(
      presetRpcURLs.filter((url) => url !== network.rpcURL),
    );
    return { urls, defaultRpcURL };
  }

  @backgroundMethod()
  async getTxHistories(
    networkId: string,
    accountId: string,
    filterOptions?: {
      isLocalOnly?: boolean;
      isHidePending?: boolean;
      contract?: string | null;
    },
  ) {
    const [dbAccount, network] = await Promise.all([
      this.dbApi.getAccount(accountId),
      this.getNetwork(networkId),
    ]);

    // TODO filter EVM history only
    if (network.impl !== IMPL_EVM) {
      return [];
    }

    const MAX_SIZE = 50;
    const localHistory = await this.getHistory(
      networkId,
      accountId,
      undefined,
      true,
      MAX_SIZE,
    );

    const localTxHistory = localHistory.filter<HistoryEntryTransaction>(
      (h): h is HistoryEntryTransaction => 'rawTx' in h,
    );

    let filtedHistory = localTxHistory;
    if (filterOptions) {
      const { contract, isHidePending } = filterOptions;

      if (contract) {
        filtedHistory = localTxHistory.filter((h) => h.contract === contract);
      }

      if (isHidePending) {
        filtedHistory = filtedHistory.filter(
          (h) => h.status !== HistoryEntryStatus.PENDING,
        );
      }
    }

    const txs = getMergedTxs(
      filtedHistory,
      network,
      dbAccount.address,
      this,
      filterOptions?.contract,
      filterOptions?.isLocalOnly,
    );

    return txs;
  }

  @backgroundMethod()
  async proxyJsonRPCCall<T>(
    networkId: string,
    request: IJsonRpcRequest,
  ): Promise<T> {
    const vault = await this.getChainOnlyVault(networkId);
    return vault.proxyJsonRPCCall(request);
  }

  @backgroundMethod()
  async getPricesAndCharts(
    networkId: string,
    tokenIdsOnNetwork: Array<string>,
    withMain = true,
  ): Promise<[Record<string, string>, Record<string, TokenChartData>]> {
    // Get price info.
    const ret: Record<string, string> = {};
    const [prices, charts] = await this.priceManager.getPricesAndCharts(
      networkId,
      tokenIdsOnNetwork.filter(
        (tokenIdOnNetwork) => tokenIdOnNetwork.length > 0,
      ),
      withMain,
    );
    Object.keys(prices).forEach((k) => {
      ret[k] = prices[k].toFixed();
    });
    return [ret, charts];
  }

  @backgroundMethod()
  async getChart(
    platform: string,
    addresses: Array<string>,
    days = '1',
    vs_currency = 'usd',
  ) {
    // Get price chart data.
    return this.priceManager.getCgkTokensChart(
      platform,
      addresses,
      days,
      vs_currency,
    );
  }

  @backgroundMethod()
  clearPriceCache() {
    return this.priceManager.cache.clear();
  }

  @backgroundMethod()
  async listFiats(): Promise<Record<string, string>> {
    const ret: Record<string, string> = {};
    const fiatSymbolList = new Set(['usd', 'cny', 'jpy', 'hkd']);
    try {
      const fiats = await this.priceManager.getFiats(fiatSymbolList);
      Object.keys(fiats).forEach((f) => {
        ret[f] = fiats[f].sd(6).toFixed();
      });
      return ret;
    } catch (e) {
      // 获取出错，返回空的列表
      return Array.from(fiatSymbolList).reduce(
        (memo, current) => ({ ...memo, [current]: undefined }),
        {},
      );
    }
  }

  @backgroundMethod()
  async updatePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    // Update global password.
    await this.validator.validatePasswordStrength(newPassword);
    return this.dbApi.updatePassword(oldPassword, newPassword);
  }

  @backgroundMethod()
  async isMasterPasswordSet(): Promise<boolean> {
    const context = await this.dbApi.getContext();
    return (
      typeof context !== 'undefined' &&
      context.verifyString !== DEFAULT_VERIFY_STRING
    );
  }

  @backgroundMethod()
  async verifyMasterPassword(password: string): Promise<boolean> {
    const context = await this.dbApi.getContext();
    if (
      typeof context !== 'undefined' &&
      context.verifyString !== DEFAULT_VERIFY_STRING
    ) {
      return checkPassword(context, password);
    }
    return true;
  }

  @backgroundMethod()
  async resetApp(): Promise<void> {
    // Reset app.
    await this.dbApi.reset();
    this.dbApi = new DbApi() as DBAPI;
    this.validator.dbApi = this.dbApi;
    return Promise.resolve();
  }
}

export { Engine };
