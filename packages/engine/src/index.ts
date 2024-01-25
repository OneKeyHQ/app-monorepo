/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint-disable @typescript-eslint/no-unsafe-member-access, no-unused-vars, @typescript-eslint/no-unused-vars */

import BigNumber from 'bignumber.js';
import * as bip39 from 'bip39';
import { cloneDeep, get, uniqBy } from 'lodash';
import natsort from 'natsort';
import RNRestart from 'react-native-restart';

import {
  mnemonicFromEntropy,
  revealableSeedFromMnemonic,
} from '@onekeyhq/engine/src/secret';
import {
  decrypt,
  encrypt,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { getShouldHideInscriptions } from '@onekeyhq/kit/src/hooks/crossHooks/useShouldHideInscriptions';
import { appSelector } from '@onekeyhq/kit/src/store';
import type { TokenChartData } from '@onekeyhq/kit/src/store/reducers/tokens';
import {
  generateUUID,
  getTimeDurationMs,
} from '@onekeyhq/kit/src/utils/helper';
import type { SendConfirmPayload } from '@onekeyhq/kit/src/views/Send/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import { CoreSDKLoader } from '@onekeyhq/shared/src/device/hardwareInstance';
import {
  COINTYPE_NEXA,
  IMPL_EVM,
  getSupportedImpls,
  isLightningNetwork,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import timelinePerfTrace, {
  ETimelinePerfNames,
} from '@onekeyhq/shared/src/perf/timelinePerfTrace';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { Avatar } from '@onekeyhq/shared/src/utils/emojiUtils';
import { getValidUnsignedMessage } from '@onekeyhq/shared/src/utils/messageUtils';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { DbApi } from './dbs';
import { DEFAULT_VERIFY_STRING, checkPassword } from './dbs/base';
import simpleDb from './dbs/simple/simpleDb';
import {
  AccountAlreadyExists,
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from './errors';
import {
  generateFakeAllnetworksAccount,
  getWalletIdFromAccountId,
  isAccountCompatibleWithNetwork,
  isAccountWithAddress,
} from './managers/account';
import {
  HDWALLET_BACKUP_VERSION,
  IMPORTED_ACCOUNT_BACKUP_VERSION,
  WATCHING_ACCOUNT_BACKUP_VERSION,
  getHDAccountUUID,
  getImportedAccountUUID,
  getWatchingAccountUUID,
} from './managers/backup';
import {
  derivationPathTemplates,
  getDefaultPurpose,
  getNextAccountId,
  parsePath,
} from './managers/derivation';
import { fetchSecurityInfo, getRiskLevel } from './managers/goplus';
import {
  getAccountNameInfoByTemplate,
  getDBAccountTemplate,
  getDefaultAccountNameInfoByImpl,
  migrateNextAccountIds,
} from './managers/impl';
import {
  fromDBNetworkToNetwork,
  getEVMNetworkToCreate,
  isAllNetworks,
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
import { PriceController } from './priceController';
import { ProviderController, fromDBNetworkToChainInfo } from './proxy';
import { AccountType } from './types/account';
import { CredentialType } from './types/credential';
import { GoPlusSupportApis } from './types/goplus';
import { HistoryEntryStatus } from './types/history';
import { TokenRiskLevel } from './types/token';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from './types/wallet';
import { Validators } from './validators';
import { createVaultHelperInstance } from './vaults/factory';
import { createVaultSettings } from './vaults/factory.createVaultSettings';
import { getMergedTxs } from './vaults/impl/evm/decoder/history';
import { IDecodedTxActionType } from './vaults/types';
import { VaultFactory } from './vaults/VaultFactory';

import type { DBAPI, ExportedSeedCredential } from './dbs/base';
import type { ChartQueryParams } from './priceController';
import type {
  Account,
  AccountCredentialType,
  DBAccount,
  DBUTXOAccount,
  ImportableHDAccount,
} from './types/account';
import type { BackupObject, ImportableHDWallet } from './types/backup';
import type { DevicePayload } from './types/device';
import type { GoPlusTokenSecurity } from './types/goplus';
import type {
  HistoryEntry,
  HistoryEntryMeta,
  HistoryEntryTransaction,
  HistoryEntryType,
} from './types/history';
import type {
  AddNetworkParams,
  DBNetwork,
  EIP1559Fee,
  Network,
  UpdateNetworkParams,
} from './types/network';
import type { Token } from './types/token';
import type { Wallet } from './types/wallet';
import type { IUnsignedMessageBtc } from './vaults/impl/btc/types';
import type VaultEvm from './vaults/impl/evm/Vault';
import type {
  IEncodedTxEvm,
  IUnsignedMessageEvm,
} from './vaults/impl/evm/Vault';
import type VaultSol from './vaults/impl/sol/Vault';
import type {
  IClientEndpointStatus,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxInteractInfo,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfoUnit,
  ISetApprovalForAll,
  ITransferInfo,
  IVaultSettings,
} from './vaults/types';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

const updateTokenCache: {
  [networkId: string]: boolean;
} = {};

if (platformEnv.isExtensionUi) {
  debugger;
  throw new Error('engine/index is not allowed imported from ui');
}

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

  async cleanupDBOnStart() {
    await this.dbApi.cleanupPendingWallets();
  }

  @backgroundMethod()
  generateMnemonic(): Promise<string> {
    // 24 words
    // return Promise.resolve(bip39.generateMnemonic(256));

    // 12 words
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
    const supportedMnemonicLength = [12, 15, 18, 21, 24];
    for (const len of supportedMnemonicLength) {
      if (mnemonic.length === len) {
        break;
      }
      if (mnemonic.length < len) {
        fixFillCount = len - mnemonic.length;
        break;
      }
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

  WALLET_SORT_WEIGHT = {
    [WALLET_TYPE_HD]: 1,
    [WALLET_TYPE_HW]: 10,
    [WALLET_TYPE_IMPORTED]: 20,
    [WALLET_TYPE_WATCHING]: 30,
    [WALLET_TYPE_EXTERNAL]: 40,
  };

  HIDDEN_WALLET_SORT_WEIGHT = {
    normal: 1,
    hidden: 10,
  };

  @backgroundMethod()
  async getWallets(option?: {
    includeAllPassphraseWallet?: boolean;
    displayPassphraseWalletIds?: string[];
  }): Promise<Array<Wallet>> {
    const wallets = await this.dbApi.getWallets(option);
    return wallets.sort((a, b) => {
      let weight =
        this.WALLET_SORT_WEIGHT[a.type] - this.WALLET_SORT_WEIGHT[b.type];
      if (weight === 0) {
        weight =
          this.HIDDEN_WALLET_SORT_WEIGHT[
            a.passphraseState || a.hidden ? 'hidden' : 'normal'
          ] -
          this.HIDDEN_WALLET_SORT_WEIGHT[
            b.passphraseState || b.hidden ? 'hidden' : 'normal'
          ];
        if (weight === 0) {
          return natsort({ insensitive: true })(a.name, b.name);
        }
      }
      return weight;
    });
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
  async getExternalWallet(): Promise<Wallet> {
    return this.getWallet(WALLET_TYPE_EXTERNAL);
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
    autoAddAccountNetworkId,
    isAutoAddAllNetworkAccounts,
  }: {
    password: string;
    mnemonic?: string;
    name?: string;
    avatar?: Avatar;
    autoAddAccountNetworkId?: string;
    isAutoAddAllNetworkAccounts?: boolean;
  }): Promise<Wallet> {
    timelinePerfTrace.mark({
      name: ETimelinePerfNames.createHDWallet,
      title: 'engine.createHDWallet >> validation START',
    });

    // Create an HD wallet, generate seed if not provided.
    if (typeof name !== 'undefined' && name.length > 0) {
      await this.validator.validateWalletName(name);
    }
    await this.validator.validatePasswordStrength(password);

    const [usedMnemonic] = await Promise.all([
      this.validator.validateMnemonic(
        mnemonic || (await this.generateMnemonic()),
      ),
      this.validator.validateHDWalletNumber(),
    ]);

    timelinePerfTrace.mark({
      name: ETimelinePerfNames.createHDWallet,
      title: 'engine.createHDWallet >> validation DONE',
    });

    let rs;
    try {
      rs = revealableSeedFromMnemonic(usedMnemonic, password);
    } catch {
      throw new OneKeyInternalError('Invalid mnemonic.');
    }

    timelinePerfTrace.mark({
      name: ETimelinePerfNames.createHDWallet,
      title: 'engine.createHDWallet >> revealableSeedFromMnemonic DONE',
    });

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

      timelinePerfTrace.mark({
        name: ETimelinePerfNames.createHDWallet,
        title: 'engine.createHDWallet >> dbApi.createHDWallet DONE',
      });

      let networks: Array<string> = [];
      if (isAutoAddAllNetworkAccounts) {
        const supportedImpls = getSupportedImpls();
        const addedImpl = new Set();
        (await this.listNetworks()).forEach(({ id: networkId, impl }) => {
          if (supportedImpls.has(impl) && !addedImpl.has(impl)) {
            addedImpl.add(impl);
            networks.push(networkId);
          }
        });
      } else {
        networks = [autoAddAccountNetworkId || OnekeyNetwork.eth];
      }

      await Promise.all(
        networks.map((networkId) =>
          this.addHdOrHwAccounts({
            password,
            walletId: wallet.id,
            networkId,
          }).then(undefined, (e) => console.error(e)),
        ),
      );
      timelinePerfTrace.mark({
        name: ETimelinePerfNames.createHDWallet,
        title:
          'engine.createHDWallet >> addHdOrHwAccounts of each network DONE',
      });

      const result = this.dbApi.confirmWalletCreated(wallet.id);

      timelinePerfTrace.mark({
        name: ETimelinePerfNames.createHDWallet,
        title: 'engine.createHDWallet >> dbApi.confirmWalletCreated DONE',
      });

      return result;
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
    const { getDeviceType, getDeviceUUID } = await CoreSDKLoader();
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
        await this.addHdOrHwAccounts({
          password: '',
          walletId: wallet.id,
          networkId: OnekeyNetwork.btc,
        });
        await this.addHdOrHwAccounts({
          password: '',
          walletId: wallet.id,
          networkId: OnekeyNetwork.eth,
        });
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
  async getAccounts(
    accountIds: Array<string>,
    networkId?: string,
  ): Promise<Array<Account>> {
    // List accounts by account ids. No token info are returned, only base account info are included.
    if (accountIds.length === 0) {
      return [];
    }

    const checkActiveWallet = () => {
      setTimeout(() => {
        const activeWalletId = appSelector((s) => s.general.activeWalletId);
        if (!activeWalletId && platformEnv.isNative) {
          RNRestart.Restart();
        }
      }, 3000);
    };

    let accounts = await this.dbApi.getAccounts(accountIds);
    if (networkId) {
      const vault = await this.getChainOnlyVault(networkId);
      accounts = await vault.filterAccounts({ accounts, networkId });
    }
    const outputAccounts = await Promise.all(
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
                addresses: isLightningNetwork(a.coinType)
                  ? JSON.stringify(get(a, 'addresses', {}))
                  : undefined,
                pubKey: get(a, 'pub', ''),
              }
            : this.getVaultWithoutCache({ accountId: a.id, networkId }).then(
                (vault) =>
                  vault.getOutputAccount().catch((error) => {
                    if (a.type === AccountType.SIMPLE) {
                      vault
                        .validateAddress(a.address)
                        .then((address) => {
                          if (!address) {
                            setTimeout(() => {
                              this.removeAccount(a.id, '', networkId, true);
                              checkActiveWallet();
                            }, 100);
                          }
                        })
                        .catch(() => {
                          setTimeout(() => {
                            this.removeAccount(a.id, '', networkId, true);
                            checkActiveWallet();
                          }, 100);
                        });
                    }
                    throw error;
                  }),
              ),
        ),
    );

    return outputAccounts.filter((a) => isAccountWithAddress(a));
  }

  @backgroundMethod()
  async getAccount(accountId: string, networkId: string): Promise<Account> {
    if (isAllNetworks(networkId)) {
      return generateFakeAllnetworksAccount({ accountId });
    }
    // Get account by id. Raise an error if account doesn't exist.
    // Token ids are included.
    const vault = await this.getVault({ accountId, networkId });
    return vault.getOutputAccount();
  }

  @backgroundMethod()
  async getAccountsByVault({
    walletId,
    networkId,
    password,
    indexes,
    purpose,
    template,
  }: {
    walletId: string;
    networkId: string;
    password: string;
    indexes: number[];
    purpose?: number;
    template?: string;
  }): Promise<ImportableHDAccount[]> {
    if (!walletId || !networkId) return [];
    const vault = await this.getWalletOnlyVault(networkId, walletId);
    const { impl } = await this.getNetwork(networkId);
    const accountNameInfo = template
      ? getAccountNameInfoByTemplate(impl, template)
      : getDefaultAccountNameInfoByImpl(impl);
    const accounts = await vault.keyring.prepareAccounts({
      type: 'SEARCH_ACCOUNTS',
      password,
      indexes,
      purpose,
      coinType: accountNameInfo.coinType,
      template: accountNameInfo.template,
      skipCheckAccountExist: true,
    });
    const addresses = await Promise.all(
      accounts.map(async (a) => {
        if (a.type === AccountType.UTXO) {
          return vault.getDisplayAddress(a.address);
        }
        if (a.type === AccountType.VARIANT) {
          return vault.addressFromBase(a);
        }
        return vault.getDisplayAddress(a.address);
      }),
    );
    const balancesAddress = await Promise.all(
      accounts.map(async (a) => {
        if (a.type === AccountType.UTXO || isLightningNetwork(a.coinType)) {
          const address = await vault.getFetchBalanceAddress(a);
          return { address };
        }
        if (a.type === AccountType.VARIANT) {
          const address = await vault.addressFromBase(a);
          return { address };
        }
        return { address: a.address };
      }),
    );
    return accounts.map((account, index) => ({
      index: indexes[index],
      path: account.path,
      defaultName: account.name,
      displayAddress: addresses[index],
      balancesAddress: balancesAddress[index].address,
      mainBalance: '0',
    }));
  }

  @backgroundMethod()
  async getDisplayAddress(networkId: string, address: string) {
    const vault = await this.getChainOnlyVault(networkId);
    return vault.getDisplayAddress(address);
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
  async getAccountPrivateKey({
    accountId,
    password,
    credentialType,
  }: {
    accountId: string;
    password: string;
    credentialType: AccountCredentialType;
  }): // networkId?: string, TODO: different curves on different networks.
  Promise<string> {
    const { coinType } = await this.dbApi.getAccount(accountId);
    // TODO: need a method to get default network from coinType.
    const networkId = {
      '60': OnekeyNetwork.eth,
      '61': OnekeyNetwork.etc,
      '503': OnekeyNetwork.cfx,
      '397': OnekeyNetwork.near,
      '0': OnekeyNetwork.btc,
      '1': OnekeyNetwork.tbtc,
      '101010': OnekeyNetwork.stc,
      '501': OnekeyNetwork.sol,
      '195': OnekeyNetwork.trx,
      '637': OnekeyNetwork.apt,
      '3': OnekeyNetwork.doge,
      '2': OnekeyNetwork.ltc,
      '145': OnekeyNetwork.bch,
      '283': OnekeyNetwork.algo,
      '144': OnekeyNetwork.xrp,
      '118': OnekeyNetwork.cosmoshub,
      '1815': OnekeyNetwork.ada,
      '461': OnekeyNetwork.fil,
      '784': OnekeyNetwork.sui,
      '354': OnekeyNetwork.dot,
      '128': OnekeyNetwork.xmr,
      '111111': OnekeyNetwork.kaspa,
      '29223': OnekeyNetwork.nexa,
    }[coinType];
    if (typeof networkId === 'undefined') {
      throw new NotImplemented('Unsupported network.');
    }

    const vault = await this.getVault({ accountId, networkId });
    return vault.getExportedCredential(password, credentialType);
  }

  @backgroundMethod()
  async queryBalanceFillAccounts(
    walletId: string,
    networkId: string,
    accounts: ImportableHDAccount[],
  ): Promise<ImportableHDAccount[]> {
    const dbNetwork = await this.dbApi.getNetwork(networkId);
    const vault = await this.getWalletOnlyVault(networkId, walletId);

    let balances: Array<BigNumber | undefined>;
    try {
      const balancesAddress = accounts.map((a) => ({
        // @ts-expect-error
        address: a.balancesAddress,
      }));
      balances = await vault.getBalances(balancesAddress);
    } catch (e) {
      balances = accounts.map(() => undefined);
    }

    return accounts.map((account, index) => {
      const balance = balances[index];
      return {
        ...account,
        mainBalance:
          typeof balance === 'undefined'
            ? '0'
            : balance.div(new BigNumber(10).pow(dbNetwork.decimals)).toFixed(),
      };
    });
  }

  @backgroundMethod()
  async searchHDAccounts(
    walletId: string,
    networkId: string,
    password: string,
    start = 0,
    limit = 10,
    purpose?: number,
    template?: string,
  ): Promise<Array<ImportableHDAccount>> {
    // Search importable HD accounts.
    const wallet = await this.dbApi.getWallet(walletId);
    if (typeof wallet === 'undefined') {
      throw new OneKeyInternalError(`Wallet ${walletId} not found.`);
    }

    const indexes = Array.from(Array(limit).keys())
      .map((index) => start + index)
      .filter((i) => i < 2 ** 31);

    const { impl } = await this.getNetwork(networkId);
    const accountNameInfo = template
      ? getAccountNameInfoByTemplate(impl, template)
      : getDefaultAccountNameInfoByImpl(impl);
    const vault = await this.getWalletOnlyVault(networkId, walletId);
    const accounts = await vault.keyring.prepareAccounts({
      type: 'SEARCH_ACCOUNTS',
      password,
      indexes,
      purpose,
      coinType: accountNameInfo.coinType,
      template: accountNameInfo.template,
    });

    const addresses = await Promise.all(
      accounts.map(async (a) => {
        if (a.type === AccountType.UTXO) {
          if (a.coinType === COINTYPE_NEXA) {
            return vault.getDisplayAddress(a.address);
          }
          // TODO: utxo should use xpub instead of its first address
          return (a as DBUTXOAccount).address;
        }
        if (a.type === AccountType.VARIANT) {
          return vault.addressFromBase(a);
        }
        return a.address;
      }),
    );

    const balancesAddress = await Promise.all(
      accounts.map(async (a) => {
        if (a.type === AccountType.UTXO || isLightningNetwork(a.coinType)) {
          const address = await vault.getFetchBalanceAddress(a);
          return { address };
        }
        if (a.type === AccountType.VARIANT) {
          const address = await vault.addressFromBase(a);
          return { address };
        }
        return { address: a.address };
      }),
    );

    return accounts.map((account, index) => ({
      index: start + index,
      path: account.path,
      defaultName: account.name,
      displayAddress: addresses[index],
      balancesAddress: balancesAddress[index].address,
      mainBalance: '0',
    }));
  }

  @backgroundMethod()
  async addHdOrHwAccounts({
    password,
    walletId,
    networkId,
    indexes,
    names,
    purpose,
    skipRepeat,
    callback,
    isAddInitFirstAccountOnly,
    template,
    skipCheckAccountExist,
  }: {
    password: string;
    walletId: string;
    networkId: string;
    indexes?: Array<number>;
    names?: Array<string>;
    purpose?: number;
    skipRepeat?: boolean;
    callback?: (_account: Account) => Promise<boolean>;
    isAddInitFirstAccountOnly?: boolean;
    template?: string;
    skipCheckAccountExist?: boolean;
  }): Promise<Array<Account>> {
    // eslint-disable-next-line no-param-reassign
    callback =
      callback ??
      ((_account: Account): Promise<boolean> => Promise.resolve(true));
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
    const accountNameInfo =
      template && template.length
        ? getAccountNameInfoByTemplate(impl, template)
        : getDefaultAccountNameInfoByImpl(impl);
    const { coinType } = accountNameInfo;
    if (!coinType) {
      throw new OneKeyInternalError(`coinType of impl=${impl} not found.`);
    }
    const nextIndex = getNextAccountId(
      wallet.nextAccountIds,
      accountNameInfo.template,
    );
    const usedIndexes = indexes || [nextIndex];
    if (isAddInitFirstAccountOnly && nextIndex > 0) {
      throw new OneKeyInternalError(
        'isAddInitFirstAccountOnly=true, skip adding next account',
      );
    }
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
      coinType,
      template: accountNameInfo.template,
      skipCheckAccountExist,
    });

    const ret: Array<Account> = [];
    for (const dbAccount of accounts) {
      try {
        const finalDbAccount = dbAccount.template
          ? dbAccount
          : { ...dbAccount, template: accountNameInfo.template };
        const { id } = await this.dbApi.addAccountToWallet(
          walletId,
          finalDbAccount,
        );

        const account = await this.getAccount(id, networkId);
        ret.push(account);
        if ((await callback(account)) === false) {
          break;
        }
      } catch (error) {
        if (skipRepeat && error instanceof AccountAlreadyExists) {
          // skip
        } else {
          throw error;
        }
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
    template?: string,
  ): Promise<Account> {
    await this.validator.validatePasswordStrength(password);
    const vault = await this.getWalletOnlyVault(networkId, 'imported');
    const dbNetwork = await this.dbApi.getNetwork(networkId);
    let privateKey: Buffer | undefined;
    try {
      privateKey = await vault.getPrivateKeyByCredential(credential);
    } catch (e) {
      console.error(e);
    }
    if (typeof privateKey === 'undefined') {
      throw new OneKeyInternalError('Invalid credential to import.');
    }

    const encryptedPrivateKey = encrypt(password, privateKey);

    const accountNameInfo =
      template && template.length
        ? getAccountNameInfoByTemplate(dbNetwork.impl, template)
        : getDefaultAccountNameInfoByImpl(dbNetwork.impl);

    const [dbAccount] = await vault.keyring.prepareAccounts({
      privateKey,
      name: name || '',
      template: accountNameInfo.template,
    });

    await this.dbApi.addAccountToWallet('imported', dbAccount, {
      type: CredentialType.PRIVATE_KEY,
      privateKey: encryptedPrivateKey,
      password,
    });

    return this.getAccount(dbAccount.id, networkId);
  }

  @backgroundMethod()
  async addWatchingOrExternalAccount({
    networkId,
    address,
    name,
    walletType,
    checkExists,
    template,
  }: {
    networkId: string;
    address: string; // address
    name: string;
    walletType: typeof WALLET_TYPE_WATCHING | typeof WALLET_TYPE_EXTERNAL;
    checkExists?: boolean;
    template?: string;
  }): Promise<Account> {
    // throw new Error('sample test error');
    // Add an watching account. Raise an error if account already exists.
    // TODO: now only adding by address is supported.
    await this.validator.validateAccountNames([name]);

    const vault = await this.getWalletOnlyVault(networkId, walletType);

    // create dbAccountInfo to save to DB
    const [dbAccount] = await vault.keyring.prepareAccounts({
      target: address,
      name,
      accountIdPrefix: walletType,
      template,
    });

    if (checkExists) {
      const [existDbAccount] = await this.dbApi.getAccounts([dbAccount.id]);
      if (existDbAccount && existDbAccount.id === dbAccount.id) {
        return this.getAccount(dbAccount.id, networkId);
      }
    }

    const a = await this.dbApi.addAccountToWallet(walletType, dbAccount);

    return this.getAccount(a.id, networkId);
  }

  @backgroundMethod()
  async removeAccount(
    accountId: string,
    password: string,
    networkId: string,
    skipPasswordCheck?: boolean,
  ): Promise<void> {
    // Remove an account. Raise an error if account doesn't exist or password is wrong.
    const walletId = getWalletIdFromAccountId(accountId);
    const [wallet, dbAccount] = await Promise.all([
      this.getWallet(walletId),
      this.dbApi.getAccount(accountId),
    ]);
    let rollbackNextAccountIds: Record<string, number> = {};

    if (dbAccount.type === AccountType.UTXO && dbAccount.path.length > 0) {
      const components = dbAccount.path.split('/');
      const index = parseInt(components[3].slice(0, -1)); // remove the "'" suffix
      const template = dbAccount.template ?? '';
      if (getNextAccountId(wallet.nextAccountIds, template) === index + 1) {
        // Removing the last account, may need to roll back next account id.
        rollbackNextAccountIds = { [template]: index };
        try {
          const vault = await this.getChainOnlyVault(networkId);
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
      skipPasswordCheck,
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
      pubKey: get(dbAccount, 'pub', ''),
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
      // return a copy to ensure the cache will not be changed
      return {
        ...(await this._findTokenWithMemo(params)),
      };
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
          if (tokenInfo) {
            const info = await fetchSecurityInfo<GoPlusTokenSecurity>({
              networkId,
              address: tokenIdOnNetwork,
              apiName: GoPlusSupportApis.token_security,
            });
            Object.assign(tokenInfo, {
              riskLevel: info ? getRiskLevel(info) : TokenRiskLevel.UNKNOWN,
            });
          }
        } catch (e) {
          debugLogger.common.error(`fetchTokenInfos error`, {
            params: [tokenIdOnNetwork],
            message: e instanceof Error ? e.message : e,
          });
        }
      }
      if (!tokenInfo) {
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

  /**
   * Currently used in Mint
   */
  @backgroundMethod()
  async activateAccount(accountId: string, networkId: string): Promise<void> {
    // Activate an account.
    const vaultSettings = await this.getVaultSettings(networkId);
    if (!vaultSettings.activateAccountRequired) return Promise.resolve();

    const vault = await this.getVault({ networkId, accountId });
    return vault.activateAccount();
  }

  @backgroundMethod()
  async activateToken(
    password: string,
    accountId: string,
    networkId: string,
    tokenIdOnNetwork: string,
  ): Promise<boolean> {
    const vaultSettings = await this.getVaultSettings(networkId);
    if (!vaultSettings.activateTokenRequired) return true;

    const normalizedAddress = await this.validator.validateTokenAddress(
      networkId,
      tokenIdOnNetwork,
    );
    if (!isAccountCompatibleWithNetwork(accountId, networkId)) {
      throw new OneKeyInternalError(
        `account ${accountId} and network ${networkId} isn't compatible.`,
      );
    }
    const vault = await this.getVault({ networkId, accountId });
    return vault.activateToken(normalizedAddress, password);
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
    if (isAllNetworks(networkId)) {
      throw new Error('Cannot generate native token for all networks.');
    }
    const network = await this.getNetwork(networkId);
    const { impl, chainId } = parseNetworkId(networkId);
    return {
      id: network.id,
      name: network.symbol,
      networkId,
      tokenIdOnNetwork: '',
      symbol: network.symbol,
      decimals: network.decimals,
      logoURI: network.logoURI,
      impl,
      chainId,
      address: '',
      source: '',
      isNative: true,
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
    // Get token info by network and account.
    let tokens = await simpleDb.token.getTokens({
      networkId,
      accountId,
    });
    if (!tokens?.length || forceReloadTokens) {
      await this.updateOnlineTokens(networkId, forceReloadTokens);
      tokens = await simpleDb.token.getTokens({
        networkId,
        accountId,
      });
    }
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
        if (!tokens.find((t) => t.isNative) && !isAllNetworks(networkId)) {
          const nativeTokensInSimpleDB = await simpleDb.token.getTokens({
            networkId,
            query: {
              isNative: true,
            },
          });
          if (nativeTokensInSimpleDB?.length > 0) {
            tokens.unshift(nativeTokensInSimpleDB[0]);
          } else {
            tokens.unshift(
              await this.generateNativeTokenByNetworkId(networkId),
            );
          }
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

  private _upateOnlineTokensWithMemo = memoizee(
    async (networkId: string, forceReloadTokens = false): Promise<void> => {
      const fetched = updateTokenCache[networkId];
      if (!forceReloadTokens && fetched) {
        return;
      }
      if (isAllNetworks(networkId)) {
        return;
      }
      const { impl, chainId } = parseNetworkId(networkId);
      if (!impl || !chainId) {
        return;
      }
      try {
        const tokens = await fetchOnlineTokens({
          impl,
          chainId,
          includeNativeToken: 1,
        });
        if (tokens.length) {
          await simpleDb.token.updateTokens(impl, chainId, tokens);
        }
      } catch (error) {
        debugLogger.engine.error(`updateOnlineTokens error`, error);
      }
      updateTokenCache[networkId] = true;
    },
    {
      promise: true,
      primitive: true,
      max: 10,
      maxAge: getTimeDurationMs({ seconds: 10 }),
      normalizer: ([networkId, foreceReloadTokens]) =>
        `${networkId}-${String(foreceReloadTokens)}`,
    },
  );

  @backgroundMethod()
  async updateOnlineTokens(
    networkId: string,
    forceReloadTokens = false,
  ): Promise<void> {
    return this._upateOnlineTokensWithMemo(networkId, forceReloadTokens);
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
    networkId: string | undefined,
    searchTerm: string,
    includeNativeToken?: 0 | 1,
  ): Promise<Array<Token>> {
    if (searchTerm.length === 0) {
      return [];
    }
    if (!networkId) {
      const result = await fetchOnlineTokens({
        query: searchTerm,
        includeNativeToken,
      });
      return result.map((t) => formatServerToken(t));
    }
    let tokenAddress = '';
    try {
      const vault = await this.getChainOnlyVault(networkId);
      tokenAddress = await vault.validateTokenAddress(searchTerm);
    } catch {
      // pass
    }

    if (tokenAddress.length > 0) {
      const token = await this.findToken({
        networkId,
        tokenIdOnNetwork: tokenAddress,
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
      onlineTokens = result.slice(0, 50).map((t) => formatServerToken(t));
    } catch (error) {
      debugLogger.engine.error('search online tokens error', {
        error: error instanceof Error ? error.message : error,
      });
    }
    const matchPattern = new RegExp(searchTerm, 'i');
    const tokens = await this.getTokens(networkId);
    const localTokens = tokens.filter(
      (token) =>
        token.name?.match(matchPattern) || token.symbol?.match(matchPattern),
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
  async batchTokensAllowance({
    networkId,
    accountId,
    tokenIdOnNetwork,
    spenders,
  }: {
    networkId: string;
    accountId: string;
    tokenIdOnNetwork: string;
    spenders: string[];
  }): Promise<number[] | undefined> {
    // TODO: move this into vaults to support multichain
    if (spenders.length === 0) {
      return;
    }
    try {
      if (!isAccountCompatibleWithNetwork(accountId, networkId)) {
        // Bad request, shouldn't happen.
        return;
      }
      const spenderAddresses: string[] = [];
      const tokenAddress = await this.validator.validateTokenAddress(
        networkId,
        tokenIdOnNetwork,
      );
      for (let i = 0; i < spenders.length; i += 1) {
        const spender = spenders[i];
        const address = await this.validator.validateAddress(
          networkId,
          spender,
        );
        spenderAddresses.push(address);
      }

      const vault = await this.getVault({ accountId, networkId });
      const result = await vault.batchTokensAllowance(
        tokenAddress,
        spenderAddresses,
      );
      return result;
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
    unsignedMessage?: IUnsignedMessageEvm | IUnsignedMessageBtc;
    password: string;
    networkId: string;
    accountId: string;
  }) {
    const vault = await this.getVault({
      accountId,
      networkId,
    });

    let validUnsignedMessage = unsignedMessage;
    if (unsignedMessage) {
      validUnsignedMessage = getValidUnsignedMessage(unsignedMessage);
    }

    const [signedMessage] = await vault.keyring.signMessage(
      [validUnsignedMessage],
      {
        password,
      },
    );
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
    signOnly,
    specifiedFeeRate,
    transferCount,
  }: {
    networkId: string;
    accountId: string;
    encodedTx: any;
    signOnly?: boolean;
    specifiedFeeRate?: string;
    transferCount?: number;
  }) {
    const vault = await this.getVault({ networkId, accountId });
    // throw new Error('test fetch fee info error');
    // TODO move to vault.fetchFeeInfo and _fetchFeeInfo
    // clone encodedTx to avoid side effects
    try {
      return await vault.fetchFeeInfo(
        cloneDeep(encodedTx),
        signOnly,
        specifiedFeeRate,
        transferCount,
      );
    } catch (error: any) {
      // AxiosError error
      const axiosError = get(error, 'code', undefined) === 429;
      // JsonRpcError error
      const jsonRpcError =
        get(error, 'response.status', undefined) === 429 ||
        get(error, 'message', undefined) === 'Wrong response<429>';

      if (axiosError || jsonRpcError) {
        throw new OneKeyInternalError(
          'Wrong response<429>',
          'msg__network_request_too_many',
        );
      }
      throw error;
    }
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
  async buildEncodedTxFromWrapperTokenDeposit({
    networkId,
    accountId,
    contract,
    amount,
  }: {
    networkId: string;
    accountId: string;
    contract: string;
    amount: string;
  }) {
    const vault = await this.getVault({ networkId, accountId });
    const impl = await vault.getNetworkImpl();
    if (impl !== IMPL_EVM) {
      throw new OneKeyInternalError(
        `networkId: ${networkId} dont support deposit`,
      );
    }
    const { address } = await this.getAccount(accountId, networkId);
    const evmVault = vault as VaultEvm;
    return evmVault.buildEncodedTxFromWrapperTokenDeposit({
      amount,
      from: address,
      contract,
    });
  }

  @backgroundMethod()
  async buildEncodedTxFromWrapperTokenWithdraw({
    networkId,
    accountId,
    contract,
    amount,
  }: {
    networkId: string;
    accountId: string;
    contract: string;
    amount: string;
  }) {
    const vault = await this.getVault({ networkId, accountId });
    const impl = await vault.getNetworkImpl();
    if (impl !== IMPL_EVM) {
      throw new OneKeyInternalError(
        `networkId: ${networkId} dont support withdraw`,
      );
    }
    const { address } = await this.getAccount(accountId, networkId);
    const evmVault = vault as VaultEvm;
    return evmVault.buildEncodedTxFromWrapperTokenWithdraw({
      amount,
      from: address,
      contract,
    });
  }

  @backgroundMethod()
  async buildEncodedTxsFromSetApproveForAll({
    networkId,
    accountId,
    approveInfos,
    prevNonce,
  }: {
    networkId: string;
    accountId: string;
    approveInfos: ISetApprovalForAll[];
    prevNonce?: number;
  }): Promise<IEncodedTx[]> {
    const vault = await this.getVault({ networkId, accountId });
    return vault.buildEncodedTxsFromSetApproveForAll(approveInfos, prevNonce);
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

    if (payload?.type === 'InternalSwap' && payload?.swapInfo) {
      const action: IDecodedTxAction = {
        type: IDecodedTxActionType.INTERNAL_SWAP,
        internalSwap: {
          ...payload.swapInfo,
          extraInfo: null,
        },
        unknownAction: {
          extraInfo: {},
        },
      };
      decodedTx.actions = [action];
    }
    return {
      decodedTx,
      decodedTxLegacy,
    };
  }

  @backgroundMethod()
  async specialCheckEncodedTx({
    networkId,
    accountId,
    encodedTx,
  }: {
    networkId: string;
    accountId: string;
    encodedTx: IEncodedTx;
  }) {
    const vault = await this.getVault({ networkId, accountId });
    return vault.specialCheckEncodedTx(encodedTx);
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
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }

    const shouldHideInscriptions = getShouldHideInscriptions({
      accountId,
      networkId,
    });
    transferInfoNew.ignoreInscriptions = shouldHideInscriptions;

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
  async buildEncodedTxFromBatchTransfer({
    networkId,
    accountId,
    transferInfos,
    prevNonce,
    isDeflationary,
  }: {
    networkId: string;
    accountId: string;
    transferInfos: ITransferInfo[];
    prevNonce?: number;
    isDeflationary?: boolean;
  }) {
    const shouldHideInscriptions = getShouldHideInscriptions({
      accountId,
      networkId,
    });

    const transferInfosNew = transferInfos.map((transferInfo) => ({
      ...transferInfo,
      ingoreInscriptions: shouldHideInscriptions,
    }));

    const vault = await this.getVault({ networkId, accountId });
    const result = await vault.buildEncodedTxFromBatchTransfer({
      transferInfos: transferInfosNew,
      prevNonce,
      isDeflationary,
    });
    debugLogger.sendTx.info(
      'buildEncodedTxFromBatchTransfer: ',
      transferInfosNew,
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
  async getGasInfo(networkId: string): Promise<{
    prices: Array<string | EIP1559Fee>;
    networkCongestion?: number;
    estimatedTransactionCount?: number;
  }> {
    const vault = await this.getChainOnlyVault(networkId);

    const gasInfo = await this.providerManager.getGasInfo(networkId);
    let prices = [];

    if (gasInfo === undefined) {
      const result = await vault.getFeePricePerUnit();
      prices = [result.normal, ...(result.others || [])]
        .sort((a, b) => (a.price.gt(b.price) ? 1 : -1))
        .map((p) => p.price)
        .slice(0, 3);
    } else {
      prices = gasInfo.prices;
    }

    if (prices.length > 0 && prices[0] instanceof BigNumber) {
      const { feeDecimals } = await this.dbApi.getNetwork(networkId);
      return {
        ...gasInfo,
        prices: (prices as Array<BigNumber>).map((price: BigNumber) =>
          price.shiftedBy(-feeDecimals).toFixed(),
        ),
      };
    }
    return gasInfo as { prices: EIP1559Fee[] };
  }

  async getVault(options: { networkId: string; accountId: string }) {
    const network = await this.getNetwork(options.networkId);
    const { rpcURL } = network;
    return this.vaultFactory.getVault({ ...options, rpcURL });
  }

  async getVaultWithoutCache(options: {
    networkId: string;
    accountId: string;
  }) {
    const network = await this.getNetwork(options.networkId);
    const { rpcURL } = network;
    return this.vaultFactory._getVaultWithoutCache({ ...options, rpcURL });
  }

  @backgroundMethod()
  async getChainOnlyVault(networkId: string) {
    return this.vaultFactory.getChainOnlyVault(networkId);
  }

  async getWalletOnlyVault(networkId: string, walletId: string) {
    return this.vaultFactory.getWalletOnlyVault(networkId, walletId);
  }

  _getVaultSettings = memoizee(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (networkId: string) => createVaultSettings({ networkId }),
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
        const vaultHelper = await createVaultHelperInstance({
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
    const dbNetworks = await this.dbApi.listNetworks();

    const devModeEnable = appSelector((s) => s.settings.devMode?.enable);
    const networks = await Promise.all(
      dbNetworks
        .filter(
          (dbNetwork) =>
            (enabledOnly ? dbNetwork.enabled : true) &&
            getSupportedImpls().has(dbNetwork.impl),
        )
        .map(async (dbNetwork) => this.dbNetworkToNetwork(dbNetwork)),
    );

    return networks.filter((network) => {
      const { settings } = network;
      if (
        platformEnv.isExtension &&
        platformEnv.isManifestV3 &&
        settings.disabledInExtensionManifestV3
      ) {
        return false;
      }

      if (platformEnv.isExtension && settings.disabledInExtension) {
        return false;
      }

      if (settings.enabledInDevModeOnly && !devModeEnable) {
        return false;
      }

      return true;
    });
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
    useCache = true,
  ): Promise<IClientEndpointStatus> {
    if (rpcURL.length === 0) {
      throw new OneKeyInternalError('Empty RPC URL.');
    }
    if (useCache) {
      return {
        ...(await this._getRPCEndpointStatus(rpcURL, networkId)),
      };
    }
    const vault = await this.getChainOnlyVault(networkId);
    return vault.getClientEndpointStatus(rpcURL);
  }

  _getRPCEndpointStatus = memoizee(
    async (rpcURL: string, networkId: string) => {
      const vault = await this.getChainOnlyVault(networkId);
      return vault.getClientEndpointStatus(rpcURL);
    },
    {
      promise: true,
      primitive: true,
      max: 1,
      maxAge: 1000 * 50,
    },
  );

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

  // This method has been deprecated using getSimplePrice in ServicePrice
  @backgroundMethod()
  async getPricesAndCharts(
    networkId: string,
    tokenIdsOnNetwork: Array<string>,
    withMain = true,
    vsCurrency?: string,
  ): Promise<[Record<string, BigNumber>, Record<string, TokenChartData>]> {
    debugLogger.engine.warn(
      'This method getPricesAndCharts has been deprecated using getSimplePrice in ServicePrice',
    );
    // Get price info
    const [prices, charts] = await this.priceManager.getPricesAndCharts(
      networkId,
      tokenIdsOnNetwork.filter(
        (tokenIdOnNetwork) => tokenIdOnNetwork.length > 0,
      ),
      withMain,
      vsCurrency,
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
  async listFiats(): Promise<Record<string, Record<string, any>>> {
    try {
      return await this.priceManager.getFiats();
    } catch (e) {
      // 获取出错，返回空的列表
      return {};
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
    return context?.verifyString !== DEFAULT_VERIFY_STRING;
  }

  @backgroundMethod()
  async verifyMasterPassword(password: string): Promise<boolean> {
    const context = await this.dbApi.getContext();
    if (context && context.verifyString !== DEFAULT_VERIFY_STRING) {
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
        const { coinType } = dbAccount;
        if (typeof derivationPathTemplates[coinType] === 'undefined') {
          debugLogger.cloudBackup.debug(
            `Backup watching account coinType ${coinType} isn't support`,
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

        const { coinType } = dbAccount;
        if (typeof derivationPathTemplates[coinType] === 'undefined') {
          debugLogger.cloudBackup.debug(
            `Backup imported account coinType ${coinType} isn't support`,
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

        // migrate nextAccountIds for old backup
        const newNextAccountIds = migrateNextAccountIds(nextAccountIds);
        const wallet = await this.dbApi.createHDWallet({
          password: localPassword,
          rs: {
            seed: encryptedSeed,
            entropyWithLangPrefixed: encryptedEntropy,
          },
          backuped: true,
          name,
          avatar,
          nextAccountIds: newNextAccountIds,
        });
        const reIdPrefix = new RegExp(`^${id}`);
        for (const accountToAdd of accounts) {
          const { coinType } = accountToAdd;
          if (typeof derivationPathTemplates[coinType] === 'undefined') {
            debugLogger.cloudBackup.debug(
              `Backup HDWallets account coinType ${coinType} isn't support`,
            );
          } else {
            accountToAdd.id = accountToAdd.id.replace(reIdPrefix, wallet.id);
            if (!accountToAdd.template) {
              accountToAdd.template = getDBAccountTemplate(accountToAdd);
            }
            await this.dbApi.addAccountToWallet(wallet.id, accountToAdd);
          }
        }
        await this.dbApi.confirmWalletCreated(wallet.id);
      }),
    );

    if (backupObject.simpleDb?.utxoAccounts) {
      await simpleDb.utxoAccounts.insertRestoreData(
        backupObject.simpleDb.utxoAccounts.utxos,
      );
    }
  }

  @backgroundMethod()
  async resetApp(): Promise<void> {
    // Reset app.
    await this.dbApi.reset();
    this.dbApi = new DbApi() as DBAPI;
    this.validator.dbApi = this.dbApi;
    return Promise.resolve();
  }

  @backgroundMethod()
  async solanaRefreshRecentBlockBash({
    accountId,
    networkId,
    transaction,
  }: {
    accountId: string;
    networkId: string;
    transaction: string;
  }): Promise<string> {
    const vault = (await this.getVault({
      accountId,
      networkId,
    })) as VaultSol;
    return vault.refreshRecentBlockBash(transaction);
  }

  @backgroundMethod()
  async getEvmNextNonce(params: { networkId: string; accountId: string }) {
    const vault = await this.getVault({
      networkId: params.networkId,
      accountId: params.accountId,
    });
    const dbAccount = await vault.getDbAccount();
    return vault.getNextNonce(params.networkId, dbAccount);
  }

  @backgroundMethod()
  async validateSendAmount({
    accountId,
    networkId,
    amount,
    tokenBalance,
    to,
  }: {
    accountId: string;
    networkId: string;
    amount: string;
    tokenBalance: string;
    to: string;
  }) {
    const vault = await this.getVault({
      networkId,
      accountId,
    });
    return vault.validateSendAmount(amount, tokenBalance, to);
  }

  @backgroundMethod()
  async notifyChainChanged(
    currentNetworkId: string,
    previousNetworkId: string,
  ) {
    const vault = await this.getVault({
      networkId: previousNetworkId,
      accountId: '',
    });
    vault.notifyChainChanged(currentNetworkId, previousNetworkId);
  }

  @backgroundMethod()
  async getFrozenBalance({
    accountId,
    networkId,
    password,
    useRecycleBalance,
    useCustomAddressesBalance,
  }: {
    accountId: string;
    networkId: string;
    password?: string;
    useRecycleBalance?: boolean;
    useCustomAddressesBalance?: boolean;
  }) {
    if (!networkId || !accountId) return 0;
    const vault = await this.getVault({
      accountId,
      networkId,
    });

    const shouldHideInscriptions = getShouldHideInscriptions({
      accountId,
      networkId,
    });

    return vault.getFrozenBalance({
      password,
      useRecycleBalance,
      ignoreInscriptions: shouldHideInscriptions,
      useCustomAddressesBalance,
    });
  }

  @backgroundMethod()
  async recomputeAccount({
    walletId,
    networkId,
    accountId,
    password,
    path,
    template,
    confirmOnDevice,
  }: {
    walletId: string;
    networkId: string;
    accountId: string;
    password: string;
    path: string;
    template?: string;
    confirmOnDevice?: boolean;
  }) {
    if (!walletId || !networkId) return [];
    if (walletId.startsWith('watching') || walletId.startsWith('imported')) {
      return this.dbApi.getAccount(accountId);
    }
    const vault = await this.getWalletOnlyVault(networkId, walletId);
    const { impl } = await this.getNetwork(networkId);
    const {
      accountIndex,
      purpose,
      coinType,
      template: defaultTemplate,
    } = parsePath(impl, path, template);
    const accounts = await vault.keyring.prepareAccounts({
      type: 'SEARCH_ACCOUNTS',
      password,
      indexes: [accountIndex],
      purpose,
      coinType,
      template: template || defaultTemplate,
      skipCheckAccountExist: true,
      confirmOnDevice,
    });
    if (accounts.length) {
      return accounts[0];
    }
    return null;
  }
}

export { Engine };
