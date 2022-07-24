/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Buffer } from 'buffer';

import { IDeviceType } from '@onekeyfe/hd-core';
import Realm from 'realm';

import {
  AccountAlreadyExists,
  NotImplemented,
  OneKeyAlreadyExistWalletError,
  OneKeyError,
  OneKeyInternalError,
  TooManyDerivedAccounts,
  TooManyImportedAccounts,
  TooManyWatchingAccounts,
  WrongPassword,
} from '../../errors';
import {
  DERIVED_ACCOUNT_MAX_NUM,
  IMPORTED_ACCOUNT_MAX_NUM,
  WATCHING_ACCOUNT_MAX_NUM,
} from '../../limits';
import { getPath } from '../../managers/derivation';
import { fromDBDeviceToDevice } from '../../managers/device';
import { walletIsImported } from '../../managers/wallet';
import { AccountType, DBAccount } from '../../types/account';
import { PrivateKeyCredential } from '../../types/credential';
import { Device, DevicePayload } from '../../types/device';
import {
  HistoryEntry,
  HistoryEntryMeta,
  HistoryEntryStatus,
  HistoryEntryType,
} from '../../types/history';
import { DBNetwork } from '../../types/network';
import { Token } from '../../types/token';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
  Wallet,
} from '../../types/wallet';
import {
  CreateHDWalletParams,
  CreateHWWalletParams,
  DBAPI,
  DEFAULT_VERIFY_STRING,
  ExportedCredential,
  MAIN_CONTEXT,
  OneKeyContext,
  SetWalletNameAndAvatarParams,
  StoredPrivateKeyCredential,
  StoredSeedCredential,
  checkPassword,
  decrypt,
  encrypt,
} from '../base';

import {
  AccountSchema,
  ContextSchema,
  CredentialSchema,
  DeviceSchema,
  HistoryEntrySchema,
  NetworkSchema,
  TokenSchema,
  WalletSchema,
} from './schemas';

const DB_PATH = 'OneKey.realm';
const SCHEMA_VERSION = 11;
/**
 * Realm DB API
 * @implements { DBAPI }
 * @NOTE: REMEMBER TO CLOSE REALM CONNECTION BEFORE EXITING APP USE `close()` METHOD
 */
class RealmDB implements DBAPI {
  private realm: Realm | undefined;

  /**
   * set update flag to true when you want to update preset networks
   * @throws {OneKeyInternalError}
   */
  constructor(update = false) {
    Realm.open({
      path: DB_PATH,
      schema: [
        NetworkSchema,
        TokenSchema,
        WalletSchema,
        AccountSchema,
        ContextSchema,
        CredentialSchema,
        HistoryEntrySchema,
        DeviceSchema,
      ],
      schemaVersion: SCHEMA_VERSION,
    })
      .then((realm) => {
        if (update || realm.empty) {
          realm.write(() => {
            if (realm.empty) {
              realm.create('Wallet', {
                id: 'watching',
                name: 'watching',
                type: WALLET_TYPE_WATCHING,
                backuped: true,
                accounts: [],
                nextAccountIds: { 'global': 1 },
              });
            }
          });
        }
        RealmDB.addImportAccountEntry(realm);
        const context = realm.objectForPrimaryKey<ContextSchema>(
          'Context',
          MAIN_CONTEXT,
        );
        if (typeof context === 'undefined') {
          realm.write(() => {
            realm.create('Context', {
              id: 'mainContext',
              verifyString: DEFAULT_VERIFY_STRING,
              nextHD: 1,
            });
          });
        }
        this.realm = realm;
      })
      .catch((error: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.error('Failed to open the realm', error.message);
        throw new OneKeyInternalError('Failed to open the realm');
      });
  }

  /**
   * close realm connection to avoid memory leak
   */
  close(): void {
    if (this.realm && !this.realm.isClosed) {
      this.realm.close();
    }
  }

  getContext(): Promise<OneKeyContext | undefined> {
    try {
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      return Promise.resolve(
        typeof context !== 'undefined' ? context.internalObj : context,
      );
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    let context: ContextSchema | undefined;
    try {
      context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (typeof context === 'undefined') {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (!checkPassword(context.internalObj, oldPassword)) {
        return Promise.reject(new WrongPassword());
      }

      if (oldPassword === newPassword) {
        return Promise.resolve();
      }

      this.realm!.write(() => {
        context!.verifyString = encrypt(
          newPassword,
          Buffer.from(DEFAULT_VERIFY_STRING),
        ).toString('hex');
        const credentials = this.realm!.objects<CredentialSchema>('Credential');
        credentials.forEach((credentialItem) => {
          if (credentialItem.id.startsWith('imported')) {
            const privateKeyCredentialJSON: StoredPrivateKeyCredential =
              JSON.parse(credentialItem.credential);
            credentialItem.credential = JSON.stringify({
              privateKey: encrypt(
                newPassword,
                decrypt(
                  oldPassword,
                  Buffer.from(privateKeyCredentialJSON.privateKey, 'hex'),
                ),
              ).toString('hex'),
            });
          } else {
            const credentialJSON: StoredSeedCredential = JSON.parse(
              credentialItem.credential,
            );
            credentialItem.credential = JSON.stringify({
              entropy: encrypt(
                newPassword,
                decrypt(
                  oldPassword,
                  Buffer.from(credentialJSON.entropy, 'hex'),
                ),
              ).toString('hex'),
              seed: encrypt(
                newPassword,
                decrypt(oldPassword, Buffer.from(credentialJSON.seed, 'hex')),
              ).toString('hex'),
            });
          }
        });
      });
      return Promise.resolve();
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * reset the storage, all data will be removed
   * @param password
   */
  reset(): Promise<void> {
    try {
      Realm.deleteFile({ path: DB_PATH });
      return Promise.resolve();
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * list all added networks in added desc order
   * @returns {Promise<DBNetwork[]>}
   */
  listNetworks(): Promise<DBNetwork[]> {
    const networks: Realm.Results<NetworkSchema> =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.realm!.objects<NetworkSchema>('Network').sorted('position');
    return Promise.resolve(networks.map((network) => network.internalObj));
  }

  /**
   * add a new network, the added network will be added to the end of the list
   * @param network
   * @returns {Promise<DBNetwork>}
   * @throws {OneKeyInternalError}
   * @NOTE: network must not exist, the new added network will be present in the head of the list
   */
  addNetwork(network: DBNetwork): Promise<DBNetwork> {
    try {
      const networkFind = this.realm!.objectForPrimaryKey<NetworkSchema>(
        'Network',
        network.id,
      );
      if (typeof networkFind !== 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Network ${network.id} already exist.`),
        );
      }
      const position: number =
        (this.realm!.objects<NetworkSchema>('Network').max(
          'position',
        ) as number) || 0;

      network.position = position + 1;
      this.realm!.write(() => {
        this.realm!.create('Network', {
          id: network.id,
          name: network.name,
          impl: network.impl,
          symbol: network.symbol,
          logoURI: network.logoURI,
          feeSymbol: network.feeSymbol,
          decimals: network.decimals,
          feeDecimals: network.feeDecimals,
          balance2FeeDecimals: network.balance2FeeDecimals,
          rpcURL: network.rpcURL,
          enabled: network.enabled,
          position: position + 1,
          explorerURL: network.explorerURL,
        });
      });
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve(network);
  }

  /**
   * get the network by id
   * @param networkId
   * @returns {Promise<DBNetwork>}
   */
  getNetwork(networkId: string): Promise<DBNetwork> {
    const network =
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.realm!.objectForPrimaryKey<NetworkSchema>('Network', networkId);
    if (typeof network === 'undefined') {
      return Promise.reject(
        new OneKeyInternalError(`Network ${networkId} not found.`),
      );
    }
    return Promise.resolve(network.internalObj);
  }

  /**
   * update network list.
   * @param networks list of tuples of network id and enabled flag
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError}
   * @NOTE: networks must include all networks exist
   */
  updateNetworkList(
    networks: [string, boolean][],
    syncingDefault = false,
  ): Promise<void> {
    try {
      const statuses = new Map<string, [number, boolean]>();
      networks.forEach((element, index) =>
        statuses.set(element[0], [index + 1, element[1]]),
      );
      const existing = this.realm!.objects<NetworkSchema>('Network');
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      this.realm!.write(() => {
        let orderChanged = false;
        existing.forEach((network) => {
          const { id } = network;
          const status = statuses.get(id);
          if (typeof status === 'undefined') {
            return;
          }
          if (network.position !== status[0]) {
            orderChanged = true;
          }
          this.realm!.create(
            'Network',
            {
              id,
              enabled: status[1],
              position: status[0],
            },
            Realm.UpdateMode.Modified,
          );
        });
        if (orderChanged && !syncingDefault) {
          if (typeof context !== 'undefined') {
            context.networkOrderChanged = true;
          }
        }
      });
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve();
  }

  /**
   * update network with given id and associated params.
   * @param networkId
   * @param params
   * @returns {Promise<DBNetwork>}
   * @NOTE: network must exist
   */
  updateNetwork(
    networkId: string,
    params: {
      name?: string;
      symbol?: string;
      rpcURL?: string;
      explorerURL?: string;
    },
  ): Promise<DBNetwork> {
    try {
      const network = this.realm!.objectForPrimaryKey<NetworkSchema>(
        'Network',
        networkId,
      );
      if (typeof network === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Network ${networkId} to update not found.`),
        );
      }
      this.realm!.write(() => {
        if (params.name) {
          network.name = params.name;
        }
        if (params.symbol) {
          network.symbol = params.symbol;
        }
        if (params.rpcURL) {
          network.rpcURL = params.rpcURL;
        }
        if (params.explorerURL) {
          network.explorerURL = params.explorerURL;
        }
      });
      return Promise.resolve(network.internalObj);
    } catch (error) {
      console.error(error);
      return Promise.reject(error);
    }
  }

  /**
   * delete network by given network id
   * @param networkId
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError}
   * @NOTE: network must exist and must be not preset
   */
  deleteNetwork(networkId: string): Promise<void> {
    try {
      const network = this.realm!.objectForPrimaryKey<NetworkSchema>(
        'Network',
        networkId,
      );
      if (typeof network !== 'undefined' && !network.preset) {
        this.realm!.write(() => {
          this.realm!.delete(network);
        });
      } else if (typeof network === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Network ${networkId} not found.`),
        );
      } else {
        return Promise.reject(
          new OneKeyInternalError(
            `Network ${networkId} is preset. delete is forbidden.`,
          ),
        );
      }
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve();
  }

  /**
   * add new customer token
   * @param token
   * @returns {Promise<Token>}
   * @throws {OneKeyInternalError}
   * @NOTE: token must not exist.
   */
  addToken(token: Token): Promise<Token> {
    try {
      const tokenFind = this.realm!.objectForPrimaryKey<TokenSchema>(
        'Token',
        token.id,
      );
      if (typeof tokenFind !== 'undefined') {
        return Promise.resolve(tokenFind.internalObj);
      }
      this.realm!.write(() => {
        this.realm!.create('Token', {
          id: token.id,
          name: token.name,
          tokenIdOnNetwork: token.tokenIdOnNetwork,
          symbol: token.symbol,
          decimals: token.decimals,
          networkId: token.networkId,
          logoURI: token.logoURI,
        });
      });
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve(token);
  }

  /**
   * get token by id
   * @param tokenId
   * @returns {Promise<Token>}
   * @throws {OneKeyInternalError}
   */
  getToken(tokenId: string): Promise<Token | undefined> {
    try {
      const token = this.realm!.objectForPrimaryKey<TokenSchema>(
        'Token',
        tokenId,
      );
      if (typeof token === 'undefined') {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(token.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * get token list by network id and associated account id
   * @param networkId
   * @param accountId optional
   * @returns {Promise<Token[]>}
   * @throws {OneKeyInternalError}
   */
  getTokens(networkId: string, accountId?: string): Promise<Token[]> {
    let tokens: Realm.Results<TokenSchema> | undefined;
    try {
      if (typeof accountId === 'undefined') {
        tokens = this.realm!.objects<TokenSchema>('Token').filtered(
          'networkId == $0',
          networkId,
        );
      } else {
        const account = this.realm!.objectForPrimaryKey<AccountSchema>(
          'Account',
          accountId,
        );
        if (typeof account === 'undefined') {
          return Promise.reject(
            new OneKeyInternalError(`Account ${accountId} not found.`),
          );
        }
        tokens = account.tokens?.filtered('networkId == $0', networkId);
      }
      return Promise.resolve((tokens || []).map((token) => token.internalObj));
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * associate token with account
   * @param accountId
   * @param tokenId
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError}
   * @NOTE: token and account must exist already
   */
  addTokenToAccount(accountId: string, tokenId: string): Promise<Token> {
    try {
      const account = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      const token = this.realm!.objectForPrimaryKey<TokenSchema>(
        'Token',
        tokenId,
      );
      if (typeof account === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      if (typeof token === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Token ${tokenId} not found.`),
        );
      }
      this.realm!.write(() => {
        account.tokens?.add(token);
      });
      return Promise.resolve(token.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * remove token from account
   * @param accountId
   * @param tokenId
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError}
   * @NOTE: token and account must exist already
   */
  removeTokenFromAccount(accountId: string, tokenId: string): Promise<void> {
    try {
      const account = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      const token = this.realm!.objectForPrimaryKey<TokenSchema>(
        'Token',
        tokenId,
      );
      if (typeof account === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      if (typeof token === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Token ${tokenId} not found.`),
        );
      }
      this.realm!.write(() => {
        if (account.tokens?.has(token)) {
          account.tokens.delete(token);
        }
      });
      return Promise.resolve();
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * retrieve all accounts
   * @returns {Promise<Wallet[]>}
   */
  getWallets(): Promise<Wallet[]> {
    try {
      const ret = [];
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (typeof context === 'undefined') {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }

      const wallets = this.realm!.objects<WalletSchema>('Wallet');
      for (const wallet of wallets) {
        if (context.pendingWallets?.has(wallet.id)) {
          const credential = this.realm!.objectForPrimaryKey<CredentialSchema>(
            'Credential',
            wallet.id,
          );
          this.realm!.write(() => {
            context.pendingWallets!.delete(wallet.id);
            this.realm!.delete(Array.from(wallet.accounts!));
            this.realm!.delete(wallet);
            if (typeof credential !== 'undefined') {
              this.realm!.delete(credential);
            }
          });
        } else {
          ret.push(wallet.internalObj);
        }
      }
      return Promise.resolve(ret);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * get a certain wallet by id
   * @param walletId
   * @returns {Promise<Wallet | undefined>}
   * @throws {OneKeyInternalError}
   */
  getWallet(walletId: string): Promise<Wallet | undefined> {
    try {
      const wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(wallet.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * associate account with wallet
   * @param walletId
   * @param account
   * @returns {Promise<DBAccount>}
   * @throws {OneKeyInternalError}
   * @NOTE: account must be not exit and wallet must be exist already(exclude watching wallet)
   */
  addAccountToWallet(
    walletId: string,
    account: DBAccount,
    importedCredential?: PrivateKeyCredential,
  ): Promise<DBAccount> {
    try {
      const wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} not found.`),
        );
      }
      const accountFind = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        account.id,
      );
      if (typeof accountFind !== 'undefined') {
        return Promise.reject(new AccountAlreadyExists());
      }
      this.realm!.write(() => {
        const accountNew = this.realm!.create('Account', account);
        wallet.accounts!.add(accountNew as AccountSchema);
        switch (wallet.type) {
          case WALLET_TYPE_WATCHING: {
            if (wallet.accounts!.size > WATCHING_ACCOUNT_MAX_NUM) {
              throw new TooManyWatchingAccounts(WATCHING_ACCOUNT_MAX_NUM);
            }
            wallet.nextAccountIds!.global += 1;
            break;
          }
          case WALLET_TYPE_HD:
          case WALLET_TYPE_HW: {
            const pathComponents = account.path.split('/');
            const category = `${pathComponents[1]}/${pathComponents[2]}`;
            const purpose = pathComponents[1].slice(0, -1);
            const coinType = pathComponents[2].slice(0, -1);

            // Check account number limit
            const accountIdPrefix = `${walletId}--m/${category}`;
            if (
              wallet.accounts!.filtered('id beginsWith $0', accountIdPrefix)
                ?.length > DERIVED_ACCOUNT_MAX_NUM
            ) {
              throw new TooManyDerivedAccounts(
                DERIVED_ACCOUNT_MAX_NUM,
                parseInt(coinType),
                parseInt(purpose),
              );
            }

            let nextId = wallet.nextAccountIds![category] || 0;
            while (
              wallet.accounts!.filtered(
                'id == $0',
                `${walletId}--${getPath(purpose, coinType, nextId)}`,
              )?.length > 0
            ) {
              nextId += 1;
            }
            wallet.nextAccountIds![category] = nextId;
            break;
          }
          case WALLET_TYPE_IMPORTED: {
            if (wallet.accounts!.size > IMPORTED_ACCOUNT_MAX_NUM) {
              throw new TooManyImportedAccounts(IMPORTED_ACCOUNT_MAX_NUM);
            }
            const context = this.realm!.objectForPrimaryKey<ContextSchema>(
              'Context',
              MAIN_CONTEXT,
            );
            if (!context) {
              return Promise.reject(
                new OneKeyInternalError('Context not found.'),
              );
            }
            if (!importedCredential) {
              return Promise.reject(
                new OneKeyInternalError(
                  'Imported credential required for adding imported accounts.',
                ),
              );
            }
            if (
              !checkPassword(context.internalObj, importedCredential.password)
            ) {
              return Promise.reject(new WrongPassword());
            }
            this.realm!.create('Credential', {
              id: account.id,
              credential: JSON.stringify({
                privateKey: importedCredential.privateKey.toString('hex'),
              }),
            });
            if (context.verifyString === DEFAULT_VERIFY_STRING) {
              context.verifyString = encrypt(
                importedCredential.password,
                Buffer.from(DEFAULT_VERIFY_STRING),
              ).toString('hex');
            }
            wallet.nextAccountIds!.global += 1;
            break;
          }
          default:
            return Promise.reject(new NotImplemented());
        }
      });
      return Promise.resolve(account);
    } catch (error: any) {
      console.error(error);
      if (error instanceof OneKeyError) {
        return Promise.reject(error);
      }
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * get a list of all accounts
   * @returns {Promise<DBAccount[]>}
   * @throws {OneKeyInternalError}
   *
   */
  getAllAccounts(): Promise<Array<DBAccount>> {
    try {
      const accounts = this.realm!.objects<AccountSchema>('Account');
      return Promise.resolve(accounts.map((account) => account.internalObj));
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * get account list by given account id list
   * @param accountIds
   * @returns {Promise<DBAccount[]>}
   * @throws {OneKeyInternalError}
   *
   */
  getAccounts(accountIds: string[]): Promise<DBAccount[]> {
    try {
      const accounts = this.realm!.objects<AccountSchema>('Account').filtered(
        accountIds.map((_, index) => `id == $${index}`).join(' OR '),
        ...accountIds,
      );
      return Promise.resolve(accounts.map((account) => account.internalObj));
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * get a certain account by id
   * @param accountId
   * @returns {Promise<DBAccount>}
   * @throws {OneKeyInternalError}
   */
  getAccount(accountId: string): Promise<DBAccount> {
    try {
      const account = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (typeof account === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      return Promise.resolve(account.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * create a new HD wallet
   * @param password
   * @param rs
   * @param name
   * @returns
   * @throws { OneKeyInternalError, WrongPassword }
   */
  createHDWallet({
    password,
    rs,
    backuped,
    name,
    avatar,
  }: CreateHDWalletParams): Promise<Wallet> {
    let context: ContextSchema | undefined;
    try {
      context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (typeof context === 'undefined') {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (!checkPassword(context.internalObj, password)) {
        return Promise.reject(new WrongPassword());
      }
      const walletId = `hd-${context.nextHD}`;
      let wallet: WalletSchema | undefined;
      this.realm!.write(() => {
        wallet = this.realm!.create('Wallet', {
          id: walletId,
          name: name || `Wallet ${context!.nextHD}`,
          avatar:
            typeof avatar === 'undefined' ? avatar : JSON.stringify(avatar),
          type: WALLET_TYPE_HD,
          backuped,
        });
        this.realm!.create('Credential', {
          id: walletId,
          credential: JSON.stringify({
            entropy: rs.entropyWithLangPrefixed.toString('hex'),
            seed: rs.seed.toString('hex'),
          }),
        });
        if (context!.verifyString === DEFAULT_VERIFY_STRING) {
          context!.verifyString = encrypt(
            password,
            Buffer.from(DEFAULT_VERIFY_STRING),
          ).toString('hex');
        }
        context!.nextHD += 1;
        context!.pendingWallets!.add(walletId);
      });
      // in order to disable lint error, here wallet is undefined is impossible ??
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError('Wallet creation failed.'),
        );
      }

      return Promise.resolve(wallet.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * add a new hw wallet
   * @param id the id of the hardware device
   * @param name the name of the wallet
   */
  async addHWWallet({
    id,
    name,
    avatar,
    connectId,
    deviceId,
    deviceType,
    deviceUUID,
    features,
  }: CreateHWWalletParams): Promise<Wallet> {
    try {
      const walletId = `hw-${id}`;

      const wallets = await this.getWallets();
      const devices = await this.getDevices();

      const hasExistWallet = wallets.some((w) => {
        if (w.associatedDevice) {
          const device = devices.find((d) => d.id === w.associatedDevice);
          if (device) {
            return device.deviceId === deviceId && device.uuid === deviceUUID;
          }
          return false;
        }
        return false;
      });

      if (hasExistWallet) {
        throw new OneKeyAlreadyExistWalletError();
      }

      await this.insertDevice(
        id,
        name,
        connectId,
        deviceUUID,
        deviceId ?? '',
        deviceType,
        features,
      );

      const foundDevice = this.realm!.objectForPrimaryKey<DeviceSchema>(
        'Device',
        id,
      );
      if (typeof foundDevice === 'undefined') {
        throw new OneKeyInternalError(`Device ${id} not found.`);
      }
      let wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        this.realm!.write(() => {
          wallet = this.realm!.create('Wallet', {
            id: walletId,
            name,
            avatar:
              typeof avatar === 'undefined' ? avatar : JSON.stringify(avatar),
            type: WALLET_TYPE_HW,
            backuped: true,
            associatedDevice: foundDevice,
            deviceType,
          });
        });
      } else {
        throw new OneKeyAlreadyExistWalletError();
      }
      return await Promise.resolve(wallet!.internalObj);
    } catch (error: any) {
      console.error(error);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      return Promise.reject(new OneKeyInternalError(error?.message ?? ''));
    }
  }

  /**
   * remove a wallet(type hd or hw only) by id
   * @param walletId
   * @param password
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError, WrongPassword}
   * @NOTE: associated accounts will be removed and credential will be removed if necessary(hw is not necessary)
   */
  removeWallet(walletId: string, password: string): Promise<void> {
    try {
      const wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} not found.`),
        );
      }
      if (
        (wallet.type as string) !== WALLET_TYPE_HD &&
        (wallet.type as string) !== WALLET_TYPE_HW
      ) {
        return Promise.reject(
          new OneKeyInternalError('Only HD or HW wallet can be removed.'),
        );
      }
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (typeof context === 'undefined') {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (wallet.type === WALLET_TYPE_HD) {
        // Only check password for HD wallet deletion.
        if (!checkPassword(context.internalObj, password)) {
          return Promise.reject(new WrongPassword());
        }
      }
      const accountIds = Array.from(wallet.accounts!).map(
        (account) => account.id,
      );
      const historyEntries =
        accountIds.length > 0
          ? this.realm!.objects<HistoryEntrySchema>('HistoryEntry').filtered(
              accountIds
                .map((_, index) => `accountId == $${index}`)
                .join(' OR '),
              ...accountIds,
            )
          : [];
      const credential = this.realm!.objectForPrimaryKey<CredentialSchema>(
        'Credential',
        walletId,
      );
      this.realm!.write(() => {
        this.realm!.delete(Array.from(wallet.accounts!));
        if (wallet.associatedDevice) {
          this.realm!.delete(wallet.associatedDevice);
        }
        this.realm!.delete(wallet);
        if (typeof credential !== 'undefined') {
          this.realm!.delete(credential);
        }
        if (historyEntries.length > 0) {
          this.realm!.delete(historyEntries);
        }
      });
      return Promise.resolve();
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * rename a already existing wallet
   * @param walletId
   * @param name
   * @returns {Promise<Wallet>}
   * @throws {OneKeyInternalError}
   */
  setWalletNameAndAvatar(
    walletId: string,
    { name, avatar }: SetWalletNameAndAvatarParams,
  ): Promise<Wallet> {
    try {
      const wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} not found.`),
        );
      }
      if (
        (wallet.type as string) !== WALLET_TYPE_HD &&
        (wallet.type as string) !== WALLET_TYPE_HW
      ) {
        return Promise.reject(
          new OneKeyInternalError('Only HD or HW wallet name can be set.'),
        );
      }
      this.realm!.write(() => {
        if (typeof name !== 'undefined') {
          wallet.name = name;
        }
        if (typeof avatar !== 'undefined') {
          wallet.avatar = JSON.stringify(avatar);
        }
      });
      return Promise.resolve(wallet.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * retrieve the stored credential of a wallet
   * @param credentialId wallet or account id
   * @param password
   * @returns {Promise<ExportedCredential>}
   * @throws {OneKeyInternalError, WrongPassword}
   * @NOTE: this method is only used for hd wallet
   */
  getCredential(
    credentialId: string,
    password: string,
  ): Promise<ExportedCredential> {
    try {
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (typeof context === 'undefined') {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (!checkPassword(context.internalObj, password)) {
        return Promise.reject(new WrongPassword());
      }
      const credential = this.realm!.objectForPrimaryKey<CredentialSchema>(
        'Credential',
        credentialId,
      );
      if (typeof credential === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Credential ${credentialId} not found.`),
        );
      }

      let exprotedCredential: ExportedCredential;
      if (walletIsImported(credentialId)) {
        const privateKeyCredentialJSON = JSON.parse(
          credential.credential,
        ) as StoredPrivateKeyCredential;
        exprotedCredential = {
          privateKey: Buffer.from(privateKeyCredentialJSON.privateKey, 'hex'),
        };
      } else {
        const credentialJSON: StoredSeedCredential = JSON.parse(
          credential.credential,
        );
        exprotedCredential = {
          entropy: Buffer.from(credentialJSON.entropy, 'hex'),
          seed: Buffer.from(credentialJSON.seed, 'hex'),
        };
      }
      return Promise.resolve(exprotedCredential);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   *  change the wallet backup status if necessary
   * @param walletId
   * @returns {Promise<Wallet>}
   * @throws {OneKeyInternalError}
   */
  confirmHDWalletBackuped(walletId: string): Promise<Wallet> {
    try {
      const wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} not found.`),
        );
      }
      if (wallet.type !== WALLET_TYPE_HD) {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} is not an HD wallet.`),
        );
      }
      if (!wallet.backuped) {
        this.realm!.write(() => {
          wallet.backuped = true;
        });
      }
      return Promise.resolve(wallet.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   *  change the wallet pending status if necessary
   * @param walletId
   * @returns {Promise<Wallet>}
   * @throws {OneKeyInternalError}
   */
  confirmWalletCreated(walletId: string): Promise<Wallet> {
    try {
      const wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.reject(new OneKeyInternalError('Wallet not found.'));
      }
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (typeof context === 'undefined') {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      this.realm!.write(() => {
        if (context.pendingWallets?.has(walletId)) {
          context.pendingWallets.delete(walletId);
        }
      });
      return Promise.resolve(wallet.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * remove a certain account from a certain wallet
   * @param walletId
   * @param accountId
   * @param password
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError, WrongPassword}
   *
   */
  removeAccount(
    walletId: string,
    accountId: string,
    password: string,
    rollbackNextAccountIds: Record<string, number>,
  ): Promise<void> {
    try {
      const wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} not found.`),
        );
      }
      if (wallet.accounts!.filtered('id == $0', accountId).length === 0) {
        return Promise.reject(
          new OneKeyInternalError(
            `Account ${accountId} associated with Wallet ${walletId} not found.`,
          ),
        );
      }
      const account = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (typeof account === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      if (wallet.type in [WALLET_TYPE_HD, WALLET_TYPE_IMPORTED]) {
        const context = this.realm!.objectForPrimaryKey<ContextSchema>(
          'Context',
          MAIN_CONTEXT,
        );
        if (typeof context === 'undefined') {
          return Promise.reject(new OneKeyInternalError('Context not found.'));
        }
        if (!checkPassword(context.internalObj, password)) {
          return Promise.reject(new WrongPassword());
        }
      }
      const historyEntries = this.realm!.objects<HistoryEntrySchema>(
        'HistoryEntry',
      ).filtered('accountId == $0', accountId);
      const credential = this.realm!.objectForPrimaryKey<CredentialSchema>(
        'Credential',
        accountId,
      );
      this.realm!.write(() => {
        wallet.accounts!.delete(account);
        this.realm!.delete(account);
        this.realm!.delete(historyEntries);
        if (walletIsImported(wallet.id) && typeof credential !== 'undefined') {
          this.realm!.delete(credential);
        }
        for (const [category, index] of Object.entries(
          rollbackNextAccountIds,
        )) {
          if (wallet.nextAccountIds![category] === index + 1) {
            wallet.nextAccountIds![category] = index;
          }
        }
      });
      return Promise.resolve();
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * rename an certain account
   * @param accountId
   * @param name new name
   * @returns {Promise<DBAccount>}
   * @throws {OneKeyInternalError}
   *
   */
  setAccountName(accountId: string, name: string): Promise<DBAccount> {
    try {
      const account = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (typeof account === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      this.realm!.write(() => {
        account.name = name;
      });
      return Promise.resolve(account.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * ????
   * @param accountId
   * @param networkId
   * @param address
   * @throws {OneKeyInternalError, NotImplemented}
   */
  addAccountAddress(
    accountId: string,
    networkId: string,
    address: string,
  ): Promise<DBAccount> {
    try {
      const account = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (typeof account === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      switch (account.type) {
        case AccountType.SIMPLE:
          this.realm!.write(() => {
            account.address = address;
          });
          break;
        case AccountType.VARIANT:
          this.realm!.write(() => {
            account.addresses![networkId] = address;
          });
          break;
        default:
          throw new NotImplemented();
      }
      return Promise.resolve(account.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  addHistoryEntry(
    id: string,
    networkId: string,
    accountId: string,
    type: HistoryEntryType,
    status: HistoryEntryStatus,
    meta: HistoryEntryMeta,
  ): Promise<void> {
    try {
      const now = Date.now();
      this.realm!.write(() => {
        this.realm!.create('HistoryEntry', {
          id,
          networkId,
          accountId,
          status,
          type,
          createdAt: now,
          updatedAt: now,
          ...meta,
        });
      });
    } catch (error: any) {
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve();
  }

  updateHistoryEntryStatuses(
    statusMap: Record<string, HistoryEntryStatus>,
  ): Promise<void> {
    try {
      const entryIds = Object.keys(statusMap);
      const toUpdate = this.realm!.objects<HistoryEntrySchema>(
        'HistoryEntry',
      ).filtered(
        entryIds.map((_, index) => `id == $${index}`).join(' OR '),
        ...entryIds,
      );
      const updatedAt = Date.now();

      this.realm!.write(() => {
        toUpdate.forEach((entry) => {
          const updatedStatus = statusMap[entry.id];
          if (entry.status !== updatedStatus) {
            entry.status = updatedStatus;
            entry.updatedAt = updatedAt;
          }
        });
      });
    } catch (error: any) {
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve();
  }

  removeHistoryEntry(entryId: string): Promise<void> {
    try {
      const entry = this.realm!.objectForPrimaryKey<HistoryEntrySchema>(
        'HistoryEntry',
        entryId,
      );
      if (typeof entry !== 'undefined') {
        this.realm!.write(() => {
          this.realm!.delete(entry);
        });
      }
    } catch (error: any) {
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve();
  }

  getHistory(
    limit: number,
    networkId: string,
    accountId: string,
    contract?: string,
    before?: number,
  ): Promise<Array<HistoryEntry>> {
    const ret: Array<HistoryEntry> = [];
    try {
      let entries = this.realm!.objects<HistoryEntrySchema>('HistoryEntry')
        .filtered('networkId == $0', networkId)
        .filtered('accountId == $0', accountId);
      if (typeof contract !== 'undefined') {
        entries = entries.filtered('contract == $0', contract);
      }
      entries = entries
        .filtered('createdAt <= $0', before || Date.now())
        .sorted('createdAt', true);
      entries.slice(0, limit).forEach((entry) => {
        ret.push(entry.internalObj);
      });
    } catch (error: any) {
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve(ret);
  }

  /**
   * insert or update a device record in the database
   * @param id
   * @param name
   * @param mac
   * @param features
   * @returns
   */
  private insertDevice(
    id: string,
    name: string,
    mac: string,
    uuid: string,
    deviceId: string,
    deviceType: IDeviceType,
    features: string,
    payloadJson = '{}',
  ): Promise<void> {
    try {
      const foundDevice = this.realm!.objectForPrimaryKey<DeviceSchema>(
        'Device',
        id,
      );
      const now = Date.now();
      if (typeof foundDevice === 'undefined') {
        /**
         * insert only for device
         */
        this.realm!.write(() => {
          this.realm!.create('Device', {
            id,
            name,
            mac,
            uuid,
            deviceId,
            deviceType,
            features,
            payloadJson,
            createdAt: now,
            updatedAt: now,
          });
        });
      }
      return Promise.resolve();
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * get all local devices
   * @returns
   */
  getDevices(): Promise<Array<Device>> {
    try {
      const devices = this.realm!.objects<DeviceSchema>('Device');
      return Promise.resolve(
        devices.map((device) => fromDBDeviceToDevice(device.internalObj)),
      );
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  getDevice(deviceId: string): Promise<Device> {
    try {
      const device = this.realm!.objectForPrimaryKey<DeviceSchema>(
        'Device',
        deviceId,
      );
      if (typeof device === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Device ${deviceId} not found.`),
        );
      }
      return Promise.resolve(fromDBDeviceToDevice(device.internalObj));
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  getDeviceByDeviceId(deviceId: string): Promise<Device> {
    try {
      const devices = this.realm!.objects<DeviceSchema>('Device')
        .filtered('deviceId == $0', deviceId)
        .sorted('createdAt', true);

      if (devices.length === 0) {
        return Promise.reject(
          new OneKeyInternalError(`Device ${deviceId} not found.`),
        );
      }
      const device = devices[0];
      return Promise.resolve(fromDBDeviceToDevice(device.internalObj));
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  updateDevicePayload(deviceId: string, payload: DevicePayload): Promise<void> {
    try {
      const devices = this.realm!.objects<DeviceSchema>('Device')
        .filtered('deviceId == $0', deviceId)
        .sorted('createdAt', true);

      if (devices.length === 0) {
        return Promise.reject(
          new OneKeyInternalError(`Device ${deviceId} not found.`),
        );
      }
      const device = devices[0];

      const now = Date.now();
      const oldPayload = fromDBDeviceToDevice(device).payload;
      const newPayload = { ...oldPayload, ...payload };
      this.realm!.write(() => {
        device.payloadJson = JSON.stringify(newPayload);
        device.updatedAt = now;
      });
      return Promise.resolve();
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  updateWalletName(walletId: string, name: string): Promise<void> {
    const wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
      'Wallet',
      walletId,
    );
    if (typeof wallet === 'undefined') {
      return Promise.reject(new OneKeyInternalError('Wallet not found.'));
    }
    this.realm!.write(() => {
      wallet.name = name;
      if (!wallet.associatedDevice) {
        return Promise.resolve();
      }
      const device = this.realm!.objectForPrimaryKey<DeviceSchema>(
        'Device',
        wallet.associatedDevice.id,
      );
      if (device) {
        device.name = name;
      }
    });
    return Promise.resolve();
  }

  private static addImportAccountEntry(realm: Realm): void {
    const importAccount = realm.objectForPrimaryKey<WalletSchema>(
      'Wallet',
      'imported',
    );
    if (typeof importAccount === 'undefined') {
      realm.write(() => {
        realm.create('Wallet', {
          id: 'imported',
          name: 'imported',
          type: WALLET_TYPE_IMPORTED,
          backuped: true,
          accounts: [],
          nextAccountIds: { 'global': 1 },
        });
      });
    }
  }
}
export { RealmDB };
