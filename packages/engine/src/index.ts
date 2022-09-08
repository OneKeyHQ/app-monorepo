/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import {
  mnemonicFromEntropy,
  revealableSeedFromMnemonic,
} from '@onekeyfe/blockchain-libs/dist/secret';
import {
  decrypt,
  encrypt,
} from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import * as bip39 from 'bip39';
import { baseDecode } from 'borsh';
import bs58 from 'bs58';
import bs58check from 'bs58check';
import { cloneDeep, uniqBy } from 'lodash';
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

import { balanceSupprtedNetwork, getBalancesFromApi } from './apiProxyUtils';
import {
  COINTYPE_BTC,
  IMPL_BTC,
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_SOL,
  NETWORK_ID_EVM_ETH,
  getSupportedImpls,
} from './constants';
import { DbApi } from './dbs';
import {
  DBAPI,
  DEFAULT_VERIFY_STRING,
  ExportedSeedCredential,
  checkPassword,
} from './dbs/base';
import simpleDb from './dbs/simple/simpleDb';
import {
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from './errors';
import {
  getWalletIdFromAccountId,
  isAccountCompatibleWithNetwork,
} from './managers/account';
import {
  HDWALLET_BACKUP_VERSION,
  IMPORTED_ACCOUNT_BACKUP_VERSION,
  WATCHING_ACCOUNT_BACKUP_VERSION,
  getHDAccountUUID,
  getImportedAccountUUID,
  getWatchingAccountUUID,
} from './managers/backup';
import { getDefaultPurpose } from './managers/derivation';
import { implToCoinTypes } from './managers/impl';
import {
  fromDBNetworkToNetwork,
  getEVMNetworkToCreate,
  parseNetworkId,
} from './managers/network';
import {
  fetchOnlineTokens,
  fetchTokenDetail,
  formatServerToken,
  getNetworkIdFromTokenId,
} from './managers/token';
import { walletCanBeRemoved, walletIsHD } from './managers/wallet';
import { getPresetNetworks, networkIsPreset } from './presets';
import { syncLatestNetworkList } from './presets/network';
import { ChartQueryParams, PriceController } from './priceController';
import { ProviderController, fromDBNetworkToChainInfo } from './proxy';
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
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
  Wallet,
} from './types/wallet';
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

import type { BackupObject, ImportableHDWallet } from './types/backup';
import type VaultEvm from './vaults/impl/evm/Vault';
import type { ITransferInfo } from './vaults/types';

const updateTokenCache: {
  [networkId: string]: boolean;
} = {};

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
  async getWallets(option?: {
    includeAllPassphraseWallet?: boolean;
    displayPassphraseWalletIds?: string[];
  }): Promise<Array<Wallet>> {
    const wallets = await this.dbApi.getWallets(option);
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
  async getWalletSafe(walletId: string): Promise<Wallet | undefined> {
    try {
      return await this.getWallet(walletId);
    } catch (error) {
      debugLogger.common.error(error);
      return undefined;
    }
  }

  @backgroundMethod()
  async getWalletByDeviceId(deviceId: string): Promise<Array<Wallet>> {
    const wallets = await this.dbApi.getWalletByDeviceId(deviceId);
    return wallets;
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
    passphraseState,
  }: {
    name?: string;
    avatar?: Avatar;
    features: IOneKeyDeviceFeatures;
    connectId: string;
    passphraseState?: string;
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
      passphraseState,
    });
    // Add BTC & ETH accounts by default.
    try {
      if (wallet.accounts.length === 0) {
        await this.addHdOrHwAccounts('', wallet.id, 'btc--0');
        await this.addHdOrHwAccounts('', wallet.id, NETWORK_ID_EVM_ETH);
      }
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
  async getHWDevice(id: string) {
    return this.dbApi.getDevice(id);
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
      if (!coinType) {
        throw new OneKeyInternalError(
          `coinType of impl=${network.impl} not found.`,
        );
      }
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
      '60': NETWORK_ID_EVM_ETH,
      '503': 'cfx--1029',
      '397': 'near--0',
      '0': 'btc--0',
      '101010': 'stc--1',
      '501': 'sol--101',
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
  ): Promise<[Record<string, string | undefined>, Token[] | undefined]> {
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

    const ret: Record<string, string | undefined> = {};
    let newTokens: Token[] | undefined;
    if (balanceSupprtedNetwork[networkId]) {
      try {
        const { address: accountAddress } = await this.getAccount(
          accountId,
          networkId,
        );
        const balancesFromApi =
          (await getBalancesFromApi(networkId, accountAddress)) || [];
        const missedTokenIds: string[] = [];
        const removedTokens = await simpleDb.token.localTokens.getRemovedTokens(
          accountId,
          networkId,
        );

        for (const { address, balance } of balancesFromApi) {
          if (
            address &&
            +balance > 0 &&
            !removedTokens.includes(address) &&
            !tokensToGet.includes(address)
          ) {
            // only record new token balances
            // other token balances still get from RPC for accuracy
            ret[address] = balance;
            missedTokenIds.push(address);
          }
        }
        if (missedTokenIds.length) {
          newTokens = (
            await Promise.all(
              missedTokenIds.map((id) =>
                this.quickAddToken(accountId, networkId, id, undefined, {
                  autoDetected: true,
                }),
              ),
            )
          )
            .filter(Boolean)
            .map((t) => ({ ...t, autoDetected: true }));
        }
      } catch (e) {
        debugLogger.common.error(`getBalancesFromApi`, {
          params: [networkId, accountId],
          message: e instanceof Error ? e.message : e,
        });
      }
    }
    const balances = await vault.getAccountBalance(tokensToGet, withMain);
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
    return [ret, newTokens];
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

    let balances: Array<BigNumber | undefined>;
    try {
      balances = await vault.getBalances(
        accounts.map((a) => {
          if (a.type === AccountType.UTXO) {
            const { xpub } = a as DBUTXOAccount;
            return { address: xpub };
          }
          return { address: a.address };
        }),
      );
    } catch (e) {
      balances = accounts.map(() => undefined);
    }
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
    const coinType = implToCoinTypes[impl];
    if (!coinType) {
      throw new OneKeyInternalError(`coinType of impl=${impl} not found.`);
    }
    const usedIndexes = indexes || [
      wallet.nextAccountIds[`${usedPurpose}'/${coinType}'`] || 0,
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
    const { impl } = parseNetworkId(networkId);
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
        case IMPL_SOL: {
          const decodedPrivateKey = bs58.decode(credential);
          if (decodedPrivateKey.length === 64) {
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
  async addWatchingOrExternalAccount({
    networkId,
    address,
    name,
    walletType,
    checkExists,
  }: {
    networkId: string;
    address: string; // address
    name: string;
    walletType: typeof WALLET_TYPE_WATCHING | typeof WALLET_TYPE_EXTERNAL;
    checkExists?: boolean;
  }): Promise<Account> {
    // throw new Error('sample test error');
    // Add an watching account. Raise an error if account already exists.
    // TODO: now only adding by address is supported.
    await this.validator.validateAccountNames([name]);

    const { impl } = parseNetworkId(networkId);
    const vault = await this.getWalletOnlyVault(networkId, walletType);

    // create dbAccountInfo to save to DB
    const [dbAccount] = await vault.keyring.prepareAccounts({
      target: address,
      name,
      accountIdPrefix: walletType,
    });

    if (checkExists) {
      const [existDbAccount] = await this.dbApi.getAccounts([dbAccount.id]);
      if (existDbAccount && existDbAccount.id === dbAccount.id) {
        return this.getAccount(dbAccount.id, networkId);
      }
    }

    const a = await this.dbApi.addAccountToWallet(walletType, dbAccount);

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

  @backgroundMethod()
  async findToken(params: { networkId: string; tokenIdOnNetwork: string }) {
    try {
      // needs await to try catch memoizee function
      return await this._findTokenWithMemo(params);
    } catch (error) {
      debugLogger.common.error(error);
      return Promise.resolve(undefined);
    }
  }

  _findTokenWithMemo = memoizee(
    async (params: {
      networkId: string;
      tokenIdOnNetwork: string;
    }): Promise<Token> => {
      const { networkId, tokenIdOnNetwork } = params;
      if (!tokenIdOnNetwork) {
        return this.getNativeTokenInfo(networkId);
      }

      const tokenId = `${networkId}--${tokenIdOnNetwork}`;
      const presetToken = await simpleDb.token.getPresetToken(
        networkId,
        tokenIdOnNetwork,
      );
      if (presetToken) {
        // Already exists in db.
        return presetToken;
      }
      let tokenInfo:
        | (Pick<Token, 'name' | 'symbol' | 'decimals'> & {
            logoURI?: string;
          })
        | undefined;
      const { impl, chainId } = parseNetworkId(networkId);
      if (!impl || !chainId) {
        throw new Error('findToken ERROR: token impl or chainId is not valid.');
      }
      tokenInfo = await fetchTokenDetail({
        impl,
        chainId,
        address: tokenIdOnNetwork,
      });
      if (!tokenInfo) {
        const vault = await this.getChainOnlyVault(networkId);
        try {
          [tokenInfo] = await vault.fetchTokenInfos([tokenIdOnNetwork]);
        } catch (e) {
          debugLogger.common.error(`fetchTokenInfos error`, {
            params: [tokenIdOnNetwork],
            message: e instanceof Error ? e.message : e,
          });
        }
      }
      if (typeof tokenInfo === 'undefined') {
        throw new Error('findToken ERROR: token not found.');
      }
      return {
        id: tokenId,
        networkId,
        tokenIdOnNetwork,
        address: tokenIdOnNetwork,
        ...tokenInfo,
        logoURI: tokenInfo.logoURI || '',
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
    logoURI?: string,
  ): Promise<Token | undefined> {
    // This method ensures token info is correctly added into DB.
    const token = await this.findToken({
      networkId,
      tokenIdOnNetwork,
    });
    if (!token) {
      return;
    }
    return simpleDb.token.addToken({
      ...token,
      logoURI: token.logoURI || logoURI || '',
    } as Token);
  }

  private async addDefaultToken(
    accountId: string,
    impl?: string,
  ): Promise<void> {
    if (!impl) {
      debugLogger.engine.error(`Can not add default token: Invalid impl`, impl);
      return;
    }
    return simpleDb.token.addDefaultToken(accountId, impl);
  }

  @backgroundMethod()
  addTokenToAccount(accountId: string, token: Token): Promise<Token> {
    // Add an token to account.
    if (
      !isAccountCompatibleWithNetwork(
        accountId,
        getNetworkIdFromTokenId(token.id),
      )
    ) {
      throw new OneKeyInternalError(
        `Cannot add token ${token.id} to account ${accountId}: incompatible.`,
      );
    }
    return simpleDb.token.addTokenToAccount(accountId, token);
  }

  @backgroundMethod()
  async quickAddToken(
    accountId: string,
    networkId: string,
    tokenIdOnNetwork: string,
    logoURI?: string,
    tokenProps?: Partial<Token>,
  ): Promise<Token | undefined> {
    let ret: Token | undefined;
    const preResult = await this.preAddToken(
      accountId,
      networkId,
      tokenIdOnNetwork,
      false,
      logoURI,
    );
    if (typeof preResult !== 'undefined') {
      ret = await this.addTokenToAccount(accountId, {
        ...preResult[1],
        ...(tokenProps || {}),
      });
    }
    return ret;
  }

  @backgroundMethod()
  async removeTokenFromAccount(
    accountId: string,
    tokenId: string,
  ): Promise<void> {
    // Remove token from an account.
    await simpleDb.token.removeTokenFromAccount(accountId, tokenId);
    try {
      await this.dbApi.removeTokenFromAccount(accountId, tokenId);
    } catch (error) {
      debugLogger.engine.error('removeTokenFromAccount error', {
        accountId,
        tokenId,
        message: error instanceof Error ? error.message : error,
      });
    }
  }

  @backgroundMethod()
  async preAddToken(
    accountId: string,
    networkId: string,
    tokenIdOnNetwork: string,
    withBalance = true,
    logoURI?: string,
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
    const token = await this.ensureTokenInDB(
      networkId,
      normalizedAddress,
      logoURI,
    );
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

  async generateNativeTokenByNetworkId(networkId: string) {
    const network = await this.getNetwork(networkId);
    return {
      id: network.id,
      name: network.symbol,
      networkId,
      tokenIdOnNetwork: '',
      symbol: network.symbol,
      decimals: network.decimals,
      logoURI: network.logoURI,
    };
  }

  _getNativeTokenInfo = memoizee(
    async (networkId: string) => {
      const tokens = await this.getTokens(networkId);
      const token = tokens.find((t) => t.isNative);
      if (token) {
        return token;
      }
      return this.generateNativeTokenByNetworkId(networkId);
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
  async getNativeTokenInfo(networkId: string) {
    return this._getNativeTokenInfo(networkId);
  }

  @backgroundMethod()
  async getTokens(
    networkId: string,
    accountId?: string,
    withMain = true,
    filterRemoved = false,
    forceReloadTokens = false,
  ): Promise<Array<Token>> {
    try {
      await this.updateOnlineTokens(networkId, forceReloadTokens);
    } catch (error) {
      debugLogger.engine.error(`updateOnlineTokens error`, {
        message: error instanceof Error ? error.message : error,
      });
    }
    // Get token info by network and account.
    const tokens = await simpleDb.token.getTokens({
      networkId,
      accountId,
    });
    const legacyAccountTokens = await this.dbApi.getTokens(
      networkId,
      accountId,
    );
    for (const t of legacyAccountTokens) {
      const presetToken = tokens.find(
        (token) => token.tokenIdOnNetwork === t.tokenIdOnNetwork,
      );
      if (!presetToken) {
        tokens.push({
          ...t,
          id: `${t.networkId}--${t.tokenIdOnNetwork}`,
          address: t.tokenIdOnNetwork,
        });
      }
    }
    if (typeof accountId !== 'undefined') {
      if (withMain) {
        if (!tokens.find((t) => t.isNative)) {
          tokens.unshift(await this.generateNativeTokenByNetworkId(networkId));
        }
        return tokens;
      }
      if (filterRemoved) {
        const removedTokens = await simpleDb.token.localTokens.getRemovedTokens(
          accountId,
          networkId,
        );
        return tokens.filter(
          (t) => !removedTokens.includes(t.tokenIdOnNetwork),
        );
      }
      return tokens;
    }
    const existingTokens = new Set(
      tokens.map((token: Token) => token.tokenIdOnNetwork),
    );
    const tokensOnNetwork = await simpleDb.token.getTokens({ networkId });

    return tokens.concat(
      tokensOnNetwork.filter(
        (token1: Token) => !existingTokens.has(token1.tokenIdOnNetwork),
      ),
    );
  }

  @backgroundMethod()
  async updateOnlineTokens(
    networkId: string,
    forceReloadTokens = false,
  ): Promise<void> {
    const fetched = updateTokenCache[networkId];
    if (!forceReloadTokens && fetched) {
      return;
    }
    const { impl, chainId } = parseNetworkId(networkId);
    if (!impl || !chainId) {
      return;
    }
    const tokens = await fetchOnlineTokens({
      impl,
      chainId,
    });
    if (tokens.length) {
      await simpleDb.token.updateTokens(impl, +chainId, tokens);
    }
    updateTokenCache[networkId] = true;
  }

  @backgroundMethod()
  async getTopTokensOnNetwork(
    networkId: string,
    limit = 50,
  ): Promise<Array<Token>> {
    const tokens = await simpleDb.token.getTokens({ networkId });
    return tokens.slice(0, limit);
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
      const token = await this.findToken({
        networkId,
        tokenIdOnNetwork: normalizedAddress,
      });
      if (token) {
        return [token];
      }
    }
    const { impl, chainId } = parseNetworkId(networkId);
    if (!impl || !chainId) {
      return [];
    }
    let onlineTokens: Token[] = [];
    try {
      const result = await fetchOnlineTokens({
        impl,
        chainId,
        query: searchTerm,
      });
      onlineTokens = result.map((t) => formatServerToken(networkId, t));
    } catch (error) {
      debugLogger.engine.error('search online tokens error', {
        error: error instanceof Error ? error.message : error,
      });
    }
    const matchPattern = new RegExp(searchTerm, 'i');
    const tokens = await this.getTokens(networkId);
    const localTokens = tokens.filter(
      (token) =>
        token.name.match(matchPattern) || token.symbol.match(matchPattern),
    );

    return uniqBy(onlineTokens.concat(localTokens), 'tokenIdOnNetwork');
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
    signOnly,
  }: {
    encodedTx: any;
    password: string;
    networkId: string;
    accountId: string;
    signOnly: boolean;
  }) {
    const vault = await this.getVault({
      accountId,
      networkId,
    });
    const unsignedTx = await vault.buildUnsignedTxFromEncodedTx(encodedTx);
    unsignedTx.payload = {
      ...unsignedTx.payload,
      encodedTx,
    };

    return vault.signAndSendTransaction(
      unsignedTx,
      {
        password,
      },
      signOnly,
    );
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

  _getVaultSettings = memoizee(
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
  getVaultSettings(networkId: string) {
    return this._getVaultSettings(networkId);
  }

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

    // TODO this.dbNetworkToNetwork(dbObj) may cause cycle calling
    //  engine.getNetwork -> engine.getVaultSettings -> engine.getChainOnlyVault -> new Vault
    //  vault.getNetwork -> engine.getNetwork
    // return this.dbNetworkToNetwork(dbObj);

    // so getNetwork() does NOT including vaultSettings field
    //    please use getVaultSettings()
    return fromDBNetworkToNetwork(dbObj, {} as IVaultSettings);
  }

  @backgroundMethod()
  async getNetworkSafe(networkId: string): Promise<Network | undefined> {
    try {
      return await this.getNetwork(networkId);
    } catch (error) {
      debugLogger.common.error(error);
      return undefined;
    }
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
    const selectedRpcURL = network.rpcURL || presetRpcURLs[0];
    const urls = [selectedRpcURL].concat(
      presetRpcURLs.filter((url) => url !== selectedRpcURL),
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
  ): Promise<[Record<string, BigNumber>, Record<string, TokenChartData>]> {
    // Get price info
    const [prices, charts] = await this.priceManager.getPricesAndCharts(
      networkId,
      tokenIdsOnNetwork.filter(
        (tokenIdOnNetwork) => tokenIdOnNetwork.length > 0,
      ),
      withMain,
    );
    return [prices, charts];
  }

  @backgroundMethod()
  async getChart(params: ChartQueryParams) {
    // Get price chart data.
    return this.priceManager.getCgkTokensChart(params);
  }

  @backgroundMethod()
  clearPriceCache() {
    return Promise.resolve(this.priceManager.cache.clear());
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

  getBackupUUID() {
    return this.dbApi.getBackupUUID();
  }

  async dumpDataForBackup(password: string): Promise<BackupObject> {
    const backupObject: BackupObject = {
      credentials: password ? await this.dbApi.dumpCredentials(password) : {},
      importedAccounts: {},
      watchingAccounts: {},
      wallets: {},
    };

    const wallets = await this.dbApi.getWallets({
      includeAllPassphraseWallet: true,
    });
    for (const wallet of wallets) {
      if (wallet.type !== WALLET_TYPE_HW && wallet.accounts.length > 0) {
        const accounts = await this.dbApi.getAccounts(wallet.accounts);

        if (wallet.type === WALLET_TYPE_IMPORTED) {
          accounts.forEach((account) => {
            const importedAccountUUID = getImportedAccountUUID(account);
            backupObject.importedAccounts[importedAccountUUID] = {
              ...account,
              version: IMPORTED_ACCOUNT_BACKUP_VERSION,
            };
          });
        } else if (wallet.type === WALLET_TYPE_WATCHING) {
          accounts.forEach((account) => {
            const watchingAccountUUID = getWatchingAccountUUID(account);
            backupObject.watchingAccounts[watchingAccountUUID] = {
              ...account,
              version: WATCHING_ACCOUNT_BACKUP_VERSION,
            };
          });
        } else if (wallet.type === WALLET_TYPE_HD) {
          const walletToBackup: ImportableHDWallet = {
            id: wallet.id,
            name: wallet.name,
            type: wallet.type,
            accounts: [],
            accountIds: [],
            nextAccountIds: wallet.nextAccountIds,
            avatar: wallet.avatar,
            version: HDWALLET_BACKUP_VERSION,
          };
          accounts.forEach((account) => {
            const HDAccountUUID = getHDAccountUUID(account);
            walletToBackup.accounts.push(account);
            walletToBackup.accountIds.push(HDAccountUUID);
          });
          backupObject.wallets[wallet.id] = walletToBackup;
        }
      }
    }
    return backupObject;
  }

  async restoreDataFromBackup({
    data,
    localPassword,
    remotePassword,
    uuidsToRestore,
  }: {
    data: string;
    localPassword: string;
    remotePassword: string;
    uuidsToRestore: {
      importedAccounts: Array<string>;
      watchingAccounts: Array<string>;
      HDWallets: Array<string>;
    };
  }) {
    if (localPassword.length === 0 && (await this.isMasterPasswordSet())) {
      debugLogger.cloudBackup.error('Local password required.');
      throw new OneKeyInternalError('Local password required.');
    }

    const backupObject = JSON.parse(data) as BackupObject;

    await Promise.all(
      uuidsToRestore.watchingAccounts.map((id) => {
        const { version, ...dbAccount } = backupObject.watchingAccounts[id];
        if (version !== WATCHING_ACCOUNT_BACKUP_VERSION) {
          // TODO: different version support
          //   - get vault from impl and recreate dbAccount.
          debugLogger.cloudBackup.debug(
            `Backup watching account version ${version} isn't compatible with current supported version ${WATCHING_ACCOUNT_BACKUP_VERSION}.`,
          );
          return;
        }
        return this.dbApi.addAccountToWallet('watching', dbAccount);
      }),
    );

    await Promise.all(
      uuidsToRestore.importedAccounts.map((id) => {
        const { version, ...dbAccount } = backupObject.importedAccounts[id];
        const { privateKey } = JSON.parse(
          backupObject.credentials[dbAccount.id],
        );
        if (version !== IMPORTED_ACCOUNT_BACKUP_VERSION) {
          // TODO: different version support
          //   - get vault from impl and recreate dbAccount.
          debugLogger.cloudBackup.debug(
            `Backup imported account version ${version} isn't compatible with current supported version ${IMPORTED_ACCOUNT_BACKUP_VERSION}.`,
          );
          return;
        }

        let encryptedPrivateKey = Buffer.from(privateKey, 'hex');
        if (localPassword !== remotePassword) {
          encryptedPrivateKey = encrypt(
            localPassword,
            decrypt(remotePassword, encryptedPrivateKey),
          );
        }
        return this.dbApi.addAccountToWallet('imported', dbAccount, {
          type: CredentialType.PRIVATE_KEY,
          privateKey: encryptedPrivateKey,
          password: localPassword,
        });
      }),
    );

    await Promise.all(
      uuidsToRestore.HDWallets.map(async (id) => {
        const { version, accounts, name, avatar, nextAccountIds } =
          backupObject.wallets[id];
        const { entropy, seed } = JSON.parse(backupObject.credentials[id]);
        if (version !== HDWALLET_BACKUP_VERSION) {
          // TODO: different version support
          //   - use mnemonic to create a new wallet, add account to it.
          debugLogger.cloudBackup.debug(
            `Backup wallet version ${version} isn't compatible with current supported version ${HDWALLET_BACKUP_VERSION}.`,
          );
          return;
        }
        let encryptedEntropy = Buffer.from(entropy, 'hex');
        let encryptedSeed = Buffer.from(seed, 'hex');
        if (localPassword !== remotePassword) {
          encryptedEntropy = encrypt(
            localPassword,
            decrypt(remotePassword, encryptedEntropy),
          );
          encryptedSeed = encrypt(
            localPassword,
            decrypt(remotePassword, encryptedSeed),
          );
        }

        const wallet = await this.dbApi.createHDWallet({
          password: localPassword,
          rs: {
            seed: encryptedSeed,
            entropyWithLangPrefixed: encryptedEntropy,
          },
          backuped: true,
          name,
          avatar,
          nextAccountIds,
        });
        const reIdPrefix = new RegExp(`^${id}`);
        for (const accountToAdd of accounts) {
          accountToAdd.id = accountToAdd.id.replace(reIdPrefix, wallet.id);
          await this.dbApi.addAccountToWallet(wallet.id, accountToAdd);
        }
        await this.dbApi.confirmWalletCreated(wallet.id);
      }),
    );
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
