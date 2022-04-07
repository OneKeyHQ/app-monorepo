/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import {
  CurveName,
  batchGetPrivateKeys,
  mnemonicFromEntropy,
  publicFromPrivate,
  revealableSeedFromMnemonic,
} from '@onekeyfe/blockchain-libs/dist/secret';
import {
  decrypt,
  encrypt,
} from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { Features } from '@onekeyfe/connect';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import * as bip39 from 'bip39';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/kit/src/background/decorators';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { IMPL_EVM, IMPL_SOL, SEPERATOR, getSupportedImpls } from './constants';
import { DbApi } from './dbs';
import {
  DBAPI,
  DEFAULT_VERIFY_STRING,
  ExportedPrivateKeyCredential,
  ExportedSeedCredential,
  checkPassword,
} from './dbs/base';
import {
  FailedToTransfer,
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from './errors';
import * as OneKeyHardware from './hardware';
import {
  getWalletIdFromAccountId,
  isAccountCompatibleWithNetwork,
} from './managers/account';
import { getErc20TransferHistories, getTxHistories } from './managers/covalent';
import { getDefaultPurpose, getXpubs } from './managers/derivation';
import {
  getAccountNameInfoByImpl,
  getDefaultCurveByCoinType,
  implToAccountType,
  implToCoinTypes,
} from './managers/impl';
import {
  fromDBNetworkToNetwork,
  getEVMNetworkToCreate,
  getImplFromNetworkId,
} from './managers/network';
import { getNetworkIdFromTokenId } from './managers/token';
import {
  walletCanBeRemoved,
  walletIsHD,
  walletIsHW,
  walletIsImported,
  walletNameCanBeUpdated,
} from './managers/wallet';
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
  getRPCStatus,
} from './proxy';
import {
  Account,
  AccountType,
  DBAccount,
  DBSimpleAccount,
  DBVariantAccount,
  ImportableHDAccount,
} from './types/account';
import { CredentialSelector, CredentialType } from './types/credential';
import {
  HistoryEntry,
  HistoryEntryMeta,
  HistoryEntryStatus,
  HistoryEntryType,
} from './types/history';
import { Message } from './types/message';
import {
  AddNetworkParams,
  EIP1559Fee,
  Network,
  UpdateNetworkParams,
} from './types/network';
import { Token } from './types/token';
import { IEncodedTxAny, IFeeInfoUnit } from './types/vault';
import { WALLET_TYPE_HD, WALLET_TYPE_HW, Wallet } from './types/wallet';
import { Validators } from './validators';
import { VaultFactory } from './vaults/VaultFactory';

import type { ITransferInfo, IVaultFactoryOptions } from './types/vault';

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
    this.validator = new Validators(this.dbApi, this.providerManager);
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

  async getCredentialSelectorForAccount(
    accountId: string,
    password: string,
  ): Promise<CredentialSelector> {
    const walletId = getWalletIdFromAccountId(accountId);
    if (walletIsHD(walletId)) {
      const { seed } = (await this.dbApi.getCredential(
        walletId,
        password,
      )) as ExportedSeedCredential;
      return {
        type: CredentialType.SOFTWARE,
        seed,
        password,
      };
    }
    if (walletIsHW(walletId)) {
      return {
        type: CredentialType.HARDWARE,
      };
    }
    if (walletIsImported(walletId)) {
      const { privateKey } = (await this.dbApi.getCredential(
        accountId,
        password,
      )) as ExportedPrivateKeyCredential;
      return {
        type: CredentialType.PRIVATE_KEY,
        privateKey,
        password,
      };
    }
    throw new OneKeyInternalError(
      `Can't get credential for account ${accountId}.`,
    );
  }

  @backgroundMethod()
  mnemonicToEntropy(mnemonic: string): Promise<string> {
    return Promise.resolve(
      bip39.mnemonicToEntropy(mnemonic, bip39.wordlists.english),
    );
  }

  @backgroundMethod()
  entropyToMnemonic(entropy: string): Promise<string> {
    return Promise.resolve(
      bip39.entropyToMnemonic(entropy, bip39.wordlists.english),
    );
  }

  @backgroundMethod()
  getWallets(): Promise<Array<Wallet>> {
    // Return all wallets, including the special imported wallet and watching wallet.
    return this.dbApi.getWallets();
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
  async createHDWallet(
    password: string,
    mnemonic?: string,
    name?: string,
  ): Promise<Wallet> {
    // Create an HD wallet, generate seed if not provided.
    if (typeof name !== 'undefined' && name.length > 0) {
      await this.validator.validateWalletName(name);
    }

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
      const wallet = await this.dbApi.createHDWallet(
        password,
        rs,
        typeof mnemonic !== 'undefined',
        name,
      );
      try {
        const supportedImpls = getSupportedImpls();
        const addedImpl = new Set();
        const networks: Array<string> = [];
        (await this.listNetworks()).forEach(({ id: networkId, impl }) => {
          if (supportedImpls.has(impl) && !addedImpl.has(impl)) {
            addedImpl.add(impl);
            networks.push(networkId);
          }
        });
        for (const networkId of networks) {
          await this.addHDAccounts(password, wallet.id, networkId);
        }
      } catch (e) {
        console.error(e);
      }
      return this.dbApi.getWallet(wallet.id) as Promise<Wallet>;
    }

    throw new OneKeyInternalError('Invalid mnemonic.');
  }

  @backgroundMethod()
  async createHWWallet(name?: string): Promise<Wallet> {
    if (typeof name !== 'undefined' && name.length > 0) {
      await this.validator.validateWalletName(name);
    }
    await this.validator.validateHWWalletNumber();
    const features = await OneKeyHardware.getFeatures();
    if (!features.initialized) {
      throw new OneKeyHardwareError('Hardware wallet not initialized.');
    }
    const id = features.onekey_serial ?? features.serial_no ?? '';
    if (id.length === 0) {
      throw new OneKeyInternalError('Bad device identity.');
    }
    const walletName = name ?? features.ble_name ?? `OneKey ${id.slice(-4)}`;
    return this.dbApi.addHWWallet(id, walletName);
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
  async setWalletName(walletId: string, name: string): Promise<Wallet> {
    // Rename a wallet, raise an error if trying to rename the imported or watching wallet.
    await this.validator.validateWalletName(name);
    if (!walletNameCanBeUpdated(walletId)) {
      throw new OneKeyInternalError(
        `Wallet ${walletId}'s name cannot be updated.`,
      );
    }
    return this.dbApi.setWalletName(walletId, name);
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

  private async buildReturnedAccount(
    dbAccount: DBAccount,
    networkId?: string,
  ): Promise<Account> {
    const account = {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.address,
    };
    switch (dbAccount.type) {
      case AccountType.SIMPLE:
        if (dbAccount.address === '' && typeof networkId !== 'undefined') {
          const address = await this.providerManager.addressFromPub(
            networkId,
            (dbAccount as DBSimpleAccount).pub,
          );
          await this.dbApi.addAccountAddress(dbAccount.id, networkId, address);
          account.address = address;
        }
        break;
      case AccountType.VARIANT:
        if (typeof networkId !== 'undefined') {
          account.address = ((dbAccount as DBVariantAccount).addresses || {})[
            networkId
          ];
          if (typeof account.address === 'undefined') {
            const address = await this.providerManager.addressFromBase(
              networkId,
              dbAccount.address,
            );
            await this.dbApi.addAccountAddress(
              dbAccount.id,
              networkId,
              address,
            );
            account.address = address;
          }
        }
        break;
      default:
        break;
    }
    return Promise.resolve(account);
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
        .sort((a, b) => (a.name > b.name ? 1 : -1))
        .map((a: DBAccount) => this.buildReturnedAccount(a, networkId)),
    );
  }

  @backgroundMethod()
  async getAccount(accountId: string, networkId: string): Promise<Account> {
    // Get account by id. Raise an error if account doesn't exist.
    // Token ids are included.
    const dbAccount = await this.dbApi.getAccount(accountId);
    const account = await this.buildReturnedAccount(dbAccount, networkId);
    account.tokens = await this.dbApi.getTokens(networkId, accountId);
    return account;
  }

  @backgroundMethod()
  async getAccountPrivateKey(
    accountId: string,
    password: string,
    // networkId?: string, TODO: different curves on different networks.
  ): Promise<string> {
    const walletId = getWalletIdFromAccountId(accountId);
    if (!walletIsHD(walletId) && !walletIsImported(walletId)) {
      throw new OneKeyInternalError(
        'Only private key of HD or imported accounts can be exported.',
      );
    }

    const credentialSelector = await this.getCredentialSelectorForAccount(
      accountId,
      password,
    );

    let encryptedPrivateKey: Buffer;
    switch (credentialSelector.type) {
      case CredentialType.SOFTWARE: {
        const dbAccount = await this.dbApi.getAccount(accountId);
        const curve = getDefaultCurveByCoinType(dbAccount.coinType);
        const pathComponents = dbAccount.path.split('/');
        const relPath = pathComponents.pop() as string;
        encryptedPrivateKey = batchGetPrivateKeys(
          curve as CurveName,
          credentialSelector.seed,
          password,
          pathComponents.join('/'),
          [relPath],
        )[0].extendedKey.key;
        break;
      }
      case CredentialType.PRIVATE_KEY:
        encryptedPrivateKey = credentialSelector.privateKey;
        break;
      default:
        throw new NotImplemented();
    }

    if (typeof encryptedPrivateKey === 'undefined') {
      throw new NotImplemented();
    }

    return `0x${decrypt(password, encryptedPrivateKey).toString('hex')}`;
  }

  @backgroundMethod()
  async getAccountBalance(
    accountId: string,
    networkId: string,
    tokenIdsOnNetwork: Array<string>,
    withMain = true,
  ): Promise<Record<string, string | undefined>> {
    // Get account balance, main token balance is always included.
    const [dbAccount, network, tokens] = await Promise.all([
      this.dbApi.getAccount(accountId),
      this.getNetwork(networkId),
      this.getTokens(networkId, accountId, false),
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
    const balances = await this.providerManager.proxyGetBalances(
      networkId,
      dbAccount,
      tokensToGet,
      withMain,
    );
    const ret: Record<string, string | undefined> = {};
    if (withMain && typeof balances[0] !== 'undefined') {
      ret.main = balances[0]
        .div(new BigNumber(10).pow(network.decimals))
        .toFixed();
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

    const { impl } = dbNetwork;
    const accountPrefix =
      getAccountNameInfoByImpl(impl)[purpose || 'default'].prefix;

    let credential: CredentialSelector;
    let outputFormat = 'pub'; // For UTXO, should be xpub, for now, only pub(software) or address(hardware) is possible.

    if (wallet.type === WALLET_TYPE_HD) {
      const { seed } = (await this.dbApi.getCredential(
        wallet.id,
        password,
      )) as ExportedSeedCredential;
      credential = {
        type: CredentialType.SOFTWARE,
        seed,
        password,
      };
    } else if (wallet.type === WALLET_TYPE_HW) {
      credential = { type: CredentialType.HARDWARE };
      outputFormat = 'address';
    } else {
      throw new OneKeyInternalError('Incorrect wallet selector.');
    }

    const accountInfos = await getXpubs(
      impl,
      credential,
      outputFormat as 'xpub' | 'pub' | 'address',
      Array.from(Array(limit).keys()).map((index) => start + index),
      purpose,
      dbNetwork.curve,
    );

    const addresses = await Promise.all(
      accountInfos.map((accountInfo) =>
        outputFormat === 'pub'
          ? this.providerManager.addressFromPub(networkId, accountInfo.info)
          : Promise.resolve(accountInfo.info),
      ),
    );
    const balances = await this.providerManager.proxyGetBalances(
      networkId,
      addresses,
      [],
    );
    return balances.map((balance, index) => ({
      index: start + index,
      path: accountInfos[index].path,
      defaultName: `${accountPrefix} #${start + index + 1}`,
      displayAddress: addresses[index],
      mainBalance:
        typeof balance === 'undefined'
          ? '0'
          : balance.div(new BigNumber(10).pow(dbNetwork.decimals)).toFixed(),
    }));
  }

  @backgroundMethod()
  async addHDAccounts(
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
    if (typeof names !== 'undefined') {
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
    const coinType = implToCoinTypes[impl];
    if (typeof coinType === 'undefined') {
      throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
    }
    const accountType = implToAccountType[impl];
    if (typeof accountType === 'undefined') {
      throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
    }
    const accountPrefix =
      getAccountNameInfoByImpl(impl)[purpose || 'default'].prefix;

    const usedPurpose = purpose || getDefaultPurpose(impl);
    const usedIndexes = indexes || [
      wallet.nextAccountIds[`${usedPurpose}'/${implToCoinTypes[impl]}'`] || 0,
    ];
    let credential: CredentialSelector;
    let outputFormat = 'pub'; // For UTXO, should be xpub, for now, only pub(software) or address(hardware) is possible.

    if (wallet.type === WALLET_TYPE_HD) {
      const { seed } = (await this.dbApi.getCredential(
        wallet.id,
        password,
      )) as ExportedSeedCredential;
      credential = {
        type: CredentialType.SOFTWARE,
        seed,
        password,
      };
    } else if (wallet.type === WALLET_TYPE_HW) {
      credential = { type: CredentialType.HARDWARE };
      outputFormat = 'address';
    } else {
      throw new OneKeyInternalError('Incorrect wallet selector.');
    }

    const accountInfos = await getXpubs(
      impl,
      credential,
      outputFormat as 'xpub' | 'pub' | 'address',
      usedIndexes,
      purpose,
      dbNetwork.curve,
    );
    const ret: Array<Account> = [];
    let accountIndex = 0;

    for (const accountInfo of accountInfos) {
      let address = '';
      if (accountType === AccountType.VARIANT && outputFormat === 'pub') {
        address = await this.providerManager.addressFromPub(
          networkId,
          accountInfo.info,
        );
        address = await this.providerManager.addressToBase(networkId, address);
      } else if (outputFormat === 'address') {
        address = accountInfo.info;
      }

      const accountNum = usedIndexes[accountIndex] + 1;
      const name =
        (names || [])[accountIndex] || `${accountPrefix} #${accountNum}`;
      const { id } = await this.dbApi.addAccountToWallet(wallet.id, {
        id: `${wallet.id}--${accountInfo.path}`,
        name,
        type: accountType,
        path: accountInfo.path,
        coinType,
        pub: outputFormat === 'pub' ? accountInfo.info : '',
        address,
      });

      await this.addDefaultToken(id, impl);

      const account = await this.getAccount(id, networkId);
      ret.push(account);
      if ((await callback(account)) === false) {
        break;
      }
      accountIndex += 1;
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
    const impl = getImplFromNetworkId(networkId);
    if (impl !== IMPL_EVM) {
      // TODO: support other impls besides EVMs.
      throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
    }

    const coinType = implToCoinTypes[impl];
    if (typeof coinType === 'undefined') {
      throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
    }
    const accountType = implToAccountType[impl];
    if (typeof accountType === 'undefined') {
      throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
    }

    const privateKey = Buffer.from(
      credential.startsWith('0x') ? credential.slice(2) : credential,
      'hex',
    );
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.'); // TODO
    }

    const curve = getDefaultCurveByCoinType(coinType) as CurveName;
    const encryptedPrivateKey = encrypt(password, privateKey);
    const publicKey = publicFromPrivate(
      curve,
      encryptedPrivateKey,
      password,
    ).toString('hex');
    const accountId = `imported--${coinType}--${publicKey}`;
    const address = await this.providerManager.addressFromPub(
      networkId,
      publicKey,
    );

    await this.dbApi.addAccountToWallet(
      'imported',
      {
        id: accountId,
        name: name || '',
        type: accountType,
        path: '',
        coinType,
        pub: publicKey,
        address,
      },
      {
        type: CredentialType.PRIVATE_KEY,
        privateKey: encryptedPrivateKey,
        password,
      },
    );

    await this.addDefaultToken(accountId, impl);

    return this.getAccount(accountId, networkId);
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
    const [, normalizedAddress] = await Promise.all([
      this.validator.validateAccountNames([name]),
      this.validator.validateAddress(networkId, target),
    ]);

    const impl = getImplFromNetworkId(networkId);
    const coinType = implToCoinTypes[impl];
    if (typeof coinType === 'undefined') {
      throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
    }
    const accountType = implToAccountType[impl];
    if (typeof accountType === 'undefined') {
      throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
    }

    let address = normalizedAddress;
    if (accountType === AccountType.VARIANT) {
      address = await this.providerManager.addressToBase(networkId, address);
    }
    const a = await this.dbApi.addAccountToWallet('watching', {
      id: `watching--${coinType}--${address}`,
      name: name || '',
      type: accountType,
      path: '',
      coinType,
      pub: '', // TODO: only address is supported for now.
      address,
    });

    await this.addDefaultToken(a.id, impl);

    return this.getAccount(a.id, networkId);
  }

  @backgroundMethod()
  removeAccount(accountId: string, password: string): Promise<void> {
    // Remove an account. Raise an error if account doesn't exist or password is wrong.
    return this.dbApi.removeAccount(
      getWalletIdFromAccountId(accountId),
      accountId,
      password,
    );
  }

  @backgroundMethod()
  async setAccountName(accountId: string, name: string): Promise<Account> {
    // Rename an account. Raise an error if account doesn't exist.
    // Nothing happens if name is not changed.
    await this.validator.validateAccountNames([name]);
    const a = await this.dbApi.setAccountName(accountId, name);
    return this.buildReturnedAccount(a);
  }

  @backgroundMethod()
  public async getOrAddToken(
    networkId: string,
    tokenIdOnNetwork: string,
    requireAlreadyAdded = false,
  ): Promise<Token | undefined> {
    let noThisToken: undefined;

    const tokenId = `${networkId}--${tokenIdOnNetwork}`;
    const token = await this.dbApi.getToken(tokenId);
    if (typeof token !== 'undefined') {
      // Already exists in db.
      return token;
    }

    if (requireAlreadyAdded) {
      throw new OneKeyInternalError(`token ${tokenIdOnNetwork} not found.`);
    }

    const toAdd = getPresetToken(networkId, tokenIdOnNetwork);
    const [tokenInfo] = await this.providerManager.getTokenInfos(networkId, [
      tokenIdOnNetwork,
    ]);
    if (typeof tokenInfo === 'undefined') {
      return noThisToken;
    }
    const overwrite: Partial<Token> = {
      id: tokenId,
      decimals: tokenInfo.decimals,
    };
    if (toAdd.decimals === -1 || getImplFromNetworkId(networkId) !== IMPL_SOL) {
      // If the token is not preset or it is not on solana, use the name and
      // symbol retrieved from the network.
      overwrite.name = tokenInfo.name;
      overwrite.symbol = tokenInfo.symbol;
    }
    return this.dbApi.addToken({ ...toAdd, ...overwrite });
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
                const token = await this.getOrAddToken(
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
    const token = await this.getOrAddToken(networkId, normalizedAddress);
    if (typeof token === 'undefined') {
      return undefined;
    }
    if (!withBalance) {
      return [undefined, token];
    }

    const dbAccount = await this.dbApi.getAccount(accountId);
    const [balance] = await this.providerManager.proxyGetBalances(
      networkId,
      dbAccount,
      [normalizedAddress],
      false,
    );
    if (typeof balance === 'undefined') {
      return undefined;
    }
    return [
      balance.div(new BigNumber(10).pow(token.decimals)).toFixed(),
      token,
    ];
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
      // TODO: add default tokens.
      if (withMain) {
        const dbNetwork = await this.dbApi.getNetwork(networkId);
        tokens.unshift({
          id: dbNetwork.id,
          name: dbNetwork.name,
          networkId,
          tokenIdOnNetwork: '',
          symbol: dbNetwork.symbol,
          decimals: dbNetwork.decimals,
          logoURI: dbNetwork.logoURI,
        });
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
          if (presetToken.decimals !== -1) {
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
    const vault = await this.vaultFactory.getVault({ networkId, accountId });

    return vault.fetchFeeInfo(encodedTx);
  }

  @backgroundMethod()
  async attachFeeInfoToEncodedTx(params: {
    networkId: string;
    accountId: string;
    encodedTx: IEncodedTxAny;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxAny> {
    const { networkId, accountId } = params;
    const vault = await this.vaultFactory.getVault({ networkId, accountId });
    return vault.attachFeeInfoToEncodedTx(params);
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
    const vault = await this.vaultFactory.getVault({ networkId, accountId });
    const result = await vault.buildEncodedTxFromTransfer(transferInfo);
    debugLogger.sendTx('buildEncodedTxFromTransfer: ', transferInfo, result, {
      networkId,
      accountId,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  }

  @backgroundMethod()
  async prepareTransfer(
    networkId: string,
    accountId: string,
    to: string,
    value: string,
    tokenIdOnNetwork?: string,
    extra?: { [key: string]: any },
  ): Promise<string> {
    console.error('prepareTransfer is deprecated!');
    // For account model networks, return the estimated gas usage.
    // TODO: For UTXO model networks, return the transaction size & selected UTXOs.
    // TODO: validate to parameter.
    let token: Token | undefined;
    if (
      typeof tokenIdOnNetwork !== 'undefined' &&
      tokenIdOnNetwork.length > 0
    ) {
      const normalizedAddress = await this.validator.validateTokenAddress(
        networkId,
        tokenIdOnNetwork,
      );
      token = await this.getOrAddToken(networkId, normalizedAddress, true);
    }
    await Promise.all([
      this.validator.validateAddress(networkId, to),
      this.validator.validateTransferValue(value),
    ]);
    const [network, dbAccount] = await Promise.all([
      this.getNetwork(networkId),
      this.dbApi.getAccount(accountId),
    ]);

    // Below properties are used to avoid redundant network requests.
    const payload = extra || {};
    payload.nonce = 1;
    payload.feePricePerUnit = new BigNumber(1);
    return (
      await this.providerManager.preSend(
        network,
        dbAccount,
        to,
        new BigNumber(value),
        token,
        payload,
      )
    ).toFixed();
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

  async getVault(options: IVaultFactoryOptions) {
    return this.vaultFactory.getVault(options);
  }

  @backgroundMethod()
  async addHistoryEntry({
    id,
    networkId,
    accountId,
    type,
    status,
    meta,
  }: {
    id: string;
    networkId: string;
    accountId: string;
    type: HistoryEntryType;
    status: HistoryEntryStatus;
    meta: HistoryEntryMeta;
  }) {
    await this.dbApi.addHistoryEntry(
      id,
      networkId,
      accountId,
      type,
      status,
      meta,
    );
  }

  @backgroundMethod()
  async transfer(
    password: string,
    networkId: string, // "evm--97"
    accountId: string, // "hd-1--m/44'/60'/0'/0/0"
    to: string,
    value: string,
    gasPrice: string,
    gasLimit: string,
    tokenIdOnNetwork?: string,
    extra?: { [key: string]: any },
  ): Promise<{ txid: string; success: boolean }> {
    console.error('transfer is deprecated!');
    // TODO transferValidator
    /*
    let token: Token | undefined;
    if (
      typeof tokenIdOnNetwork !== 'undefined' &&
      tokenIdOnNetwork.length > 0
    ) {
      const normalizedAddress = await this.validator.validateTokenAddress(
        networkId,
        tokenIdOnNetwork,
      );
      token = await this.getOrAddToken(networkId, normalizedAddress, true);
    }
    await Promise.all([
      this.validator.validateAddress(networkId, to),
      this.validator.validateTransferValue(value),
    ]);

    const [credential, network, dbAccount] = await Promise.all([
      this.getCredentialSelectorForAccount(accountId, password),
      this.getNetwork(networkId),
      this.dbApi.getAccount(accountId),
    ]);
    */
    debugLogger.engine('transfer:', {
      password: '***',
      networkId,
      accountId,
      to,
      value,
      gasPrice,
      gasLimit,
      tokenIdOnNetwork,
      extra,
    });
    const vault = await this.getVault({
      accountId,
      networkId,
    });

    try {
      const { txid, rawTx } = await vault.simpleTransfer(
        {
          to,
          value,
          tokenIdOnNetwork,
          extra,
          gasLimit,
          gasPrice,
        },
        { password },
      );
      const historyId = `${networkId}--${txid}`;
      await this.dbApi.addHistoryEntry(
        historyId,
        networkId,
        accountId,
        HistoryEntryType.TRANSFER,
        HistoryEntryStatus.PENDING,
        {
          contract: tokenIdOnNetwork || '',
          target: to,
          value,
          rawTx,
        },
      );
      return { txid, success: true };
    } catch (e) {
      console.error(e);
      const { message } = e as { message: string };
      throw new FailedToTransfer(message);
    }
  }

  @backgroundMethod()
  async signMessage(
    password: string,
    networkId: string,
    accountId: string,
    messages: Array<Message>,
    ref?: string,
  ): Promise<Array<string>> {
    // TODO: address check needed?
    const [credential, network, dbAccount] = await Promise.all([
      this.getCredentialSelectorForAccount(accountId, password),
      this.getNetwork(networkId),
      this.dbApi.getAccount(accountId),
    ]);

    const signatures = await this.providerManager.signMessages(
      credential,
      password,
      network,
      dbAccount,
      messages,
    );
    const now = Date.now();
    await Promise.all(
      signatures.map((signature, index) =>
        this.dbApi.addHistoryEntry(
          `${networkId}--m-${now}-${index}`,
          networkId,
          accountId,
          HistoryEntryType.SIGN,
          HistoryEntryStatus.SIGNED,
          { message: JSON.stringify(messages[index]), ref: ref || '' },
        ),
      ),
    );
    return signatures;
  }

  @backgroundMethod()
  async signTransaction(
    password: string,
    networkId: string,
    accountId: string,
    transactions: Array<string>,
    overwriteParams?: string,
    _ref?: string,
    autoBroadcast = true,
  ): Promise<Array<string>> {
    const [credentialSelector, network, dbAccount] = await Promise.all([
      this.getCredentialSelectorForAccount(accountId, password),
      this.getNetwork(networkId),
      this.dbApi.getAccount(accountId),
    ]);
    const ret: Array<string> = [];
    try {
      const txsWithStatus = await this.providerManager.signTransactions(
        credentialSelector,
        network,
        dbAccount,
        transactions,
        overwriteParams,
        autoBroadcast,
      );
      txsWithStatus.forEach(async (tx) => {
        ret.push(autoBroadcast ? tx.txid : tx.rawTx);
        const meta = { ...tx.txMeta, rawTx: tx.rawTx };
        await this.dbApi.addHistoryEntry(
          `${networkId}--${tx.txid}`,
          networkId,
          accountId,
          HistoryEntryType.TRANSACTION,
          autoBroadcast && tx.success
            ? HistoryEntryStatus.PENDING
            : HistoryEntryStatus.SIGNED,
          meta as HistoryEntryMeta,
        );
      });
    } catch (e) {
      const { message } = e as { message: string };
      throw new FailedToTransfer(message);
    }

    return Promise.resolve(ret);
  }

  // TODO: sign & broadcast.
  // signTransaction
  // broadcastRawTransaction

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
    let updatedStatusMap: Record<string, HistoryEntryStatus> = {};

    if (updatePending) {
      const pendings: Array<string> = [];
      entries.forEach((entry) => {
        if (entry.status === HistoryEntryStatus.PENDING) {
          pendings.push(entry.id);
        }
      });

      updatedStatusMap = await this.providerManager.refreshPendingTxs(
        networkId,
        pendings,
      );
      if (Object.keys(updatedStatusMap).length > 0) {
        await this.dbApi.updateHistoryEntryStatuses(updatedStatusMap);
      }
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
    return networks
      .filter(
        (dbNetwork) =>
          (enabledOnly ? dbNetwork.enabled : true) &&
          getSupportedImpls().has(dbNetwork.impl),
      )
      .map((dbNetwork) => fromDBNetworkToNetwork(dbNetwork));
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
  getRPCEndpointStatus(
    rpcURL: string,
    impl: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    if (rpcURL.length === 0) {
      throw new OneKeyInternalError('Empty RPC URL.');
    }

    return getRPCStatus(rpcURL, impl);
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
    return fromDBNetworkToNetwork(dbObj);
  }

  @backgroundMethod()
  async getNetwork(networkId: string): Promise<Network> {
    const dbObj = await this.dbApi.getNetwork(networkId);
    return fromDBNetworkToNetwork(dbObj);
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
    return fromDBNetworkToNetwork(dbObj);
  }

  @backgroundMethod()
  deleteNetwork(networkId: string): Promise<void> {
    if (networkIsPreset(networkId)) {
      throw new OneKeyInternalError('Preset network cannot be deleted.');
    }
    return this.dbApi.deleteNetwork(networkId);
  }

  @backgroundMethod()
  async getRPCEndpoints(networkId: string): Promise<Array<string>> {
    // List preset/saved rpc endpoints of a network.
    const network = await this.dbApi.getNetwork(networkId);
    const presetNetworks = getPresetNetworks();
    const { presetRpcURLs } = presetNetworks[networkId] || {
      presetRpcURLs: [],
    };
    return [network.rpcURL].concat(
      presetRpcURLs.filter((url) => url !== network.rpcURL),
    );
  }

  @backgroundMethod()
  async getTxHistories(
    networkId: string,
    accountId: string,
    pageNumber: number,
    pageSize: number,
  ) {
    const [dbAccount, network] = await Promise.all([
      this.dbApi.getAccount(accountId),
      this.getNetwork(networkId),
    ]);

    if (network.impl !== IMPL_EVM) {
      return { data: null, error: false, errorMessage: null, errorCode: null };
    }

    if (typeof dbAccount === 'undefined') {
      return { data: null, error: false, errorMessage: null, errorCode: null };
    }

    if (dbAccount.type !== AccountType.SIMPLE) {
      return { data: null, error: false, errorMessage: null, errorCode: null };
    }
    const chainId = network.id.split(SEPERATOR)[1];

    return getTxHistories(chainId, dbAccount.address, pageNumber, pageSize);
  }

  async getErc20TxHistories(
    networkId: string,
    accountId: string,
    contract: string,
    pageNumber: number,
    pageSize: number,
  ) {
    const [dbAccount, network] = await Promise.all([
      this.dbApi.getAccount(accountId),
      this.getNetwork(networkId),
    ]);

    if (network.impl !== IMPL_EVM) {
      return { data: null, error: false, errorMessage: null, errorCode: null };
    }

    if (typeof dbAccount === 'undefined') {
      return { data: null, error: false, errorMessage: null, errorCode: null };
    }

    if (dbAccount.type !== AccountType.SIMPLE) {
      return { data: null, error: false, errorMessage: null, errorCode: null };
    }

    const chainId = network.id.split(SEPERATOR)[1];
    return getErc20TransferHistories(
      chainId,
      dbAccount.address,
      contract,
      pageNumber,
      pageSize,
    );
  }

  @backgroundMethod()
  proxyRPCCall<T>(networkId: string, request: IJsonRpcRequest): Promise<T> {
    return this.providerManager.proxyRPCCall(networkId, request);
  }

  @backgroundMethod()
  async getPrices(
    networkId: string,
    tokenIdsOnNetwork: Array<string>,
    withMain = true,
  ): Promise<Record<string, string>> {
    // Get price info.
    const ret: Record<string, string> = {};
    const prices = await this.priceManager.getPrices(
      networkId,
      tokenIdsOnNetwork.filter(
        (tokenIdOnNetwork) => tokenIdOnNetwork.length > 0,
      ),
      withMain,
    );
    Object.keys(prices).forEach((k) => {
      ret[k] = prices[k].toFixed();
    });
    return ret;
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

  setFiat(symbol: string): Promise<void> {
    // Set fiat symbol that is used throughout the app.
    console.log(`setFiat ${symbol}`);
    throw new NotImplemented();
  }

  @backgroundMethod()
  updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    // Update global password.
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

  /**
   * store device info
   * @param features
   * @param mac the identifier of the device(mac address if android, uuid if ios)
   * @returns
   */
  @backgroundMethod()
  upsertDevice(features: Features, mac: string): Promise<void> {
    const id = features.onekey_serial ?? features.serial_no ?? '';
    if (id.length === 0 || mac.length === 0) {
      throw new OneKeyInternalError('Bad device identity.');
    }
    const name =
      features.ble_name ?? features.label ?? `OneKey ${id.slice(-4)}`;
    return this.dbApi.upsertDevice(id, name, mac, JSON.stringify(features));
  }
}

export { Engine };
