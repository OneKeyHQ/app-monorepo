/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Buffer } from 'buffer';

import RNUUID from 'react-native-uuid';
import Realm from 'realm';

import {
  decrypt,
  encrypt,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import {
  filterPassphraseWallet,
  handleDisplayPassphraseWallet,
} from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
// import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  AccountAlreadyExists,
  NotImplemented,
  OneKeyAlreadyExistWalletError,
  OneKeyError,
  OneKeyHardwareError,
  OneKeyInternalError,
  TooManyDerivedAccounts,
  TooManyExternalAccounts,
  TooManyImportedAccounts,
  TooManyWatchingAccounts,
  WrongPassword,
} from '../../errors';
import {
  DERIVED_ACCOUNT_MAX_NUM,
  EXTERNAL_ACCOUNT_MAX_NUM,
  IMPORTED_ACCOUNT_MAX_NUM,
  WATCHING_ACCOUNT_MAX_NUM,
} from '../../limits';
import {
  getAccountDerivationPrimaryKey,
  getNextAccountIdsWithAccountDerivation,
} from '../../managers/derivation';
import { fromDBDeviceToDevice } from '../../managers/device';
import { getImplByCoinType } from '../../managers/impl';
import { walletIsImported } from '../../managers/wallet';
import { AccountType } from '../../types/account';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '../../types/wallet';
import {
  DEFAULT_RPC_ENDPOINT_TO_CLEAR,
  DEFAULT_VERIFY_STRING,
  MAIN_CONTEXT,
  checkPassword,
} from '../base';

import {
  AccountDerivationSchema,
  AccountSchema,
  ContextSchema,
  CredentialSchema,
  CustomFeeSchema,
  DeviceSchema,
  HistoryEntrySchema,
  NetworkSchema,
  TokenSchema,
  WalletSchema,
} from './schemas';

import type { DBAccount } from '../../types/account';
import type {
  DBAccountDerivation,
  IAddAccountDerivationParams,
  ISetAccountTemplateParams,
} from '../../types/accountDerivation';
import type {
  PrivateKeyCredential,
  PrivateKeyCredentialWithId,
} from '../../types/credential';
import type { Device, DevicePayload } from '../../types/device';
import type {
  HistoryEntry,
  HistoryEntryMeta,
  HistoryEntryStatus,
  HistoryEntryType,
} from '../../types/history';
import type { DBNetwork } from '../../types/network';
import type { Token } from '../../types/token';
import type { ISetNextAccountIdsParams, Wallet } from '../../types/wallet';
import type { IFeeInfoUnit } from '../../vaults/types';
import type {
  CreateHDWalletParams,
  CreateHWWalletParams,
  DBAPI,
  ExportedCredential,
  ExportedPrivateKeyCredential,
  OneKeyContext,
  SetWalletNameAndAvatarParams,
  StoredPrivateKeyCredential,
  StoredSeedCredential,
} from '../base';
import type { IDeviceType } from '@onekeyfe/hd-core';

const DB_PATH = 'OneKey.realm';
const SCHEMA_VERSION = 19;
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        AccountDerivationSchema,
        CustomFeeSchema,
      ],
      schemaVersion: SCHEMA_VERSION,
      onMigration: (oldRealm: Realm, newRealm: Realm) => {
        if (oldRealm.schemaVersion < 13) {
          const networks = newRealm.objects<NetworkSchema>('Network');
          for (const network of networks) {
            const toClear = DEFAULT_RPC_ENDPOINT_TO_CLEAR[network.id];
            if (typeof toClear !== 'undefined' && network.rpcURL === toClear) {
              network.rpcURL = '';
            }
          }
        }
      },
    })
      .then((realm) => {
        RealmDB.addSingletonWalletEntry({ realm, walletId: 'watching' });
        RealmDB.addSingletonWalletEntry({ realm, walletId: 'imported' });
        RealmDB.addSingletonWalletEntry({
          realm,
          walletId: 'external',
        });

        const context = realm.objectForPrimaryKey<ContextSchema>(
          'Context',
          MAIN_CONTEXT,
        );
        if (!context) {
          realm.write(() => {
            realm.create('Context', {
              id: 'mainContext',
              verifyString: DEFAULT_VERIFY_STRING,
              nextHD: 1,
            });
          });
        }
        this.realm = realm;

        // TODO: enable realm plugin when migrate to hermes
        // if (
        //   platformEnv.isDev &&
        //   platformEnv.isNative &&
        //   // @ts-ignore
        //   !global.$$realmPluginInited
        // ) {
        //   const RootSiblingsManager = (
        //     require('react-native-root-siblings') as typeof import('react-native-root-siblings')
        //   ).default;
        //   const RealmPlugin = require('realm-flipper-plugin-device').default;
        //   // const { PortalEntry } =
        //   //   require('@onekeyhq/kit/src/views/Overlay/RootPortal') as typeof import('@onekeyhq/kit/src/views/Overlay/RootPortal');
        //   // const { FULLWINDOW_OVERLAY_PORTAL } =
        //   //   require('@onekeyhq/kit/src/utils/overlayUtils') as typeof import('@onekeyhq/kit/src/utils/overlayUtils');
        //   // eslint-disable-next-line no-new
        //   new RootSiblingsManager(
        //     (
        //       // <PortalEntry target={FULLWINDOW_OVERLAY_PORTAL}>
        //       <RealmPlugin realms={[realm]} />
        //       // </PortalEntry>
        //     ),
        //   );
        //   // console.log('realm plugin inited');
        //   // @ts-ignore
        //   global.$$realmPluginInited = true;
        // }
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

  getContext(): Promise<OneKeyContext | null | undefined> {
    try {
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      return Promise.resolve(context ? context.internalObj : context);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    let context: ContextSchema | null | undefined;
    try {
      context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (!context) {
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
          if (walletIsImported(credentialItem.id)) {
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

  getBackupUUID(): Promise<string> {
    let context: ContextSchema | null | undefined;
    try {
      context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );

      if (!context) {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }

      if (context.backupUUID !== '') {
        return Promise.resolve(context.backupUUID);
      }

      const backupUUID = RNUUID.v4() as string;
      this.realm!.write(() => {
        context!.backupUUID = backupUUID;
      });
      return Promise.resolve(backupUUID);
    } catch (error: any) {
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  dumpCredentials(password: string): Promise<Record<string, string>> {
    try {
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (!context) {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (!checkPassword(context.internalObj, password)) {
        return Promise.reject(new WrongPassword());
      }

      const credentials = this.realm!.objects<CredentialSchema>('Credential');
      return Promise.resolve(
        credentials.reduce(
          (mapping, { id, credential }) =>
            Object.assign(mapping, { [id]: credential }),
          {},
        ),
      );
    } catch (error: any) {
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
      if (networkFind) {
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
    if (!network) {
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
          if (context) {
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
      if (!network) {
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
      if (network && !network.preset) {
        this.realm!.write(() => {
          this.realm!.delete(network);
        });
      } else if (!network) {
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
      if (tokenFind) {
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
      if (!token) {
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
      if (!accountId) {
        tokens = this.realm!.objects<TokenSchema>('Token').filtered(
          'networkId == $0',
          networkId,
        );
      } else {
        const account = this.realm!.objectForPrimaryKey<AccountSchema>(
          'Account',
          accountId,
        );
        if (!account) {
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
      if (!account) {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      if (!token) {
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
      if (!account) {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      if (!token) {
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
  getWallets(option?: {
    includeAllPassphraseWallet?: boolean;
    displayPassphraseWalletIds?: string[];
  }): Promise<Wallet[]> {
    try {
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (!context) {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }

      const wallets = this.realm!.objects<WalletSchema>('Wallet');
      return Promise.resolve(
        wallets
          .map((w) => w.internalObj)
          .filter(
            (w) =>
              !context.pendingWallets?.has(w.id) &&
              filterPassphraseWallet(
                w,
                option?.includeAllPassphraseWallet,
                option?.displayPassphraseWalletIds,
              ),
          ),
      );
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
      if (!wallet) {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(wallet.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  getWalletByDeviceId(deviceId: string): Promise<Array<Wallet>> {
    try {
      const wallet = this.realm!.objects<WalletSchema>('Wallet').filtered(
        'associatedDevice.id == $0',
        deviceId,
      );
      return Promise.resolve(wallet.map((w) => w.internalObj));
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
      if (!wallet) {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} not found.`),
        );
      }
      const accountFind = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        account.id,
      );
      if (accountFind) {
        return Promise.reject(new AccountAlreadyExists());
      }
      this.realm!.write(async () => {
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
          case WALLET_TYPE_EXTERNAL: {
            if (wallet.accounts!.size > EXTERNAL_ACCOUNT_MAX_NUM) {
              throw new TooManyExternalAccounts(EXTERNAL_ACCOUNT_MAX_NUM);
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

            if (!account.template) {
              return Promise.reject(
                new OneKeyInternalError(`Account should has template field`),
              );
            }
            const impl = getImplByCoinType(account.coinType);
            const template = account.template ?? '';
            const accountDerivationId = getAccountDerivationPrimaryKey({
              walletId,
              impl,
              template,
            });
            let accountDerivation =
              this.realm!.objectForPrimaryKey<AccountDerivationSchema>(
                'AccountDerivation',
                accountDerivationId,
              );
            if (!accountDerivation) {
              this.realm!.create('AccountDerivation', {
                id: accountDerivationId,
                walletId,
                accounts: [account.id],
                template,
              });
              accountDerivation =
                this.realm!.objectForPrimaryKey<AccountDerivationSchema>(
                  'AccountDerivation',
                  accountDerivationId,
                );
            } else {
              accountDerivation.accounts.push(account.id);
            }

            let nextId = wallet.nextAccountIds![template] || 0;
            nextId = getNextAccountIdsWithAccountDerivation(
              accountDerivation?.internalObj ?? ({} as DBAccountDerivation),
              nextId,
              purpose,
              coinType,
            );
            wallet.nextAccountIds![template] = nextId;
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

  getAccountByAddress({
    address,
    coinType,
  }: {
    address: string;
    coinType?: string;
  }): Promise<DBAccount> {
    try {
      let entries = this.realm!.objects<AccountSchema>('Account').filtered(
        'address == $0',
        address,
      );
      if (coinType) {
        entries = entries.filtered('coinType == $0', coinType);
      }

      if (entries.length === 0) {
        return Promise.reject(
          new OneKeyInternalError(`Account ${address} not found.`),
        );
      }
      return Promise.resolve(entries[0].internalObj);
    } catch (error: any) {
      debugLogger.common.error(error);
      return Promise.reject(
        new OneKeyInternalError(`Account ${address} not found.`),
      );
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
      if (!account) {
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
    nextAccountIds = {},
  }: CreateHDWalletParams): Promise<Wallet> {
    let context: ContextSchema | null | undefined;
    try {
      context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (!context) {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (!checkPassword(context.internalObj, password)) {
        return Promise.reject(new WrongPassword());
      }
      const walletId = `hd-${context.nextHD}`;
      let wallet: WalletSchema | null = null;
      this.realm!.write(() => {
        wallet = this.realm!.create('Wallet', {
          id: walletId,
          name: name || `Wallet ${context!.nextHD}`,
          avatar:
            typeof avatar === 'undefined' ? avatar : JSON.stringify(avatar),
          type: WALLET_TYPE_HD,
          backuped,
          nextAccountIds,
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
      if (wallet) {
        return Promise.resolve((wallet as WalletSchema).internalObj);
      }
      return Promise.reject(new OneKeyInternalError('Wallet creation failed.'));
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
    passphraseState,
  }: CreateHWWalletParams): Promise<Wallet> {
    try {
      const wallets = await this.getWallets({
        includeAllPassphraseWallet: true,
      });
      const devices = await this.getDevices();

      const existDevice = devices.find(
        (d) => d.deviceId === deviceId && d.uuid === deviceUUID,
      );
      const hasExistWallet = wallets.find((w) => {
        if (!existDevice) return undefined;

        return (
          w.associatedDevice === existDevice?.id &&
          w.passphraseState === passphraseState
        );
      });

      if (hasExistWallet) {
        if (passphraseState) {
          handleDisplayPassphraseWallet(hasExistWallet.id);
          // return await Promise.resolve(hasExistWallet);
        }

        return await Promise.reject(
          new OneKeyAlreadyExistWalletError(
            hasExistWallet.id,
            hasExistWallet.name,
          ),
        );
      }

      if (!existDevice) {
        await this.insertDevice(
          id,
          name,
          connectId,
          deviceUUID,
          deviceId ?? '',
          deviceType,
          features,
        );
      }

      const deviceTableId = existDevice ? existDevice.id : id;
      let walletId = `hw-${deviceTableId}`;
      if (passphraseState) {
        walletId = `hw-${deviceTableId}-${passphraseState}`;
      }

      const foundDevice = this.realm!.objectForPrimaryKey<DeviceSchema>(
        'Device',
        deviceTableId,
      );
      if (!foundDevice) {
        return await Promise.reject(
          new OneKeyInternalError(`Device ${id} not found.`),
        );
      }
      let wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );

      if (wallet && !passphraseState) {
        return await Promise.reject(
          new OneKeyAlreadyExistWalletError(wallet.id, wallet.name),
        );
      }

      if (!wallet) {
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
            passphraseState,
          });
        });
      }

      if (passphraseState) {
        if (wallet) {
          handleDisplayPassphraseWallet(wallet.id);
        }
      }

      return await Promise.resolve(wallet!.internalObj);
    } catch (error: any) {
      if (error instanceof OneKeyHardwareError) {
        return Promise.reject(error);
      }
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
      if (!wallet) {
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
      if (!context) {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (wallet.type === WALLET_TYPE_HD) {
        // Only check password for HD wallet deletion.
        if (!checkPassword(context.internalObj, password)) {
          return Promise.reject(new WrongPassword());
        }
      }

      let removeDevice = false;
      if (wallet.type === WALLET_TYPE_HW && wallet.associatedDevice) {
        const hwWallet = this.realm!.objects<WalletSchema>('Wallet').filtered(
          'associatedDevice.id == $0',
          wallet.associatedDevice.id,
        );
        if (hwWallet.length <= 1) {
          removeDevice = true;
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
        if (removeDevice && wallet.associatedDevice) {
          this.realm!.delete(wallet.associatedDevice);
        }
        this.realm!.delete(wallet);
        if (credential) {
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
      if (!wallet) {
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
        if (name) {
          wallet.name = name;
        }
        if (avatar) {
          wallet.avatar = JSON.stringify(avatar);
        }
      });
      return Promise.resolve(wallet.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  updateWalletNextAccountIds({
    walletId,
    nextAccountIds,
  }: ISetNextAccountIdsParams): Promise<Wallet> {
    try {
      const wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (!wallet) {
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
        Object.entries(nextAccountIds).forEach(([k, v]) => {
          wallet.nextAccountIds![k] = v;
        });
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
      if (!context) {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (!checkPassword(context.internalObj, password)) {
        return Promise.reject(new WrongPassword());
      }
      const credential = this.realm!.objectForPrimaryKey<CredentialSchema>(
        'Credential',
        credentialId,
      );
      if (!credential) {
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

  createPrivateKeyCredential(
    credential: PrivateKeyCredentialWithId,
  ): Promise<ExportedPrivateKeyCredential> {
    try {
      if (!credential) {
        return Promise.reject(new OneKeyInternalError('Credential required.'));
      }
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (!context) {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (!checkPassword(context.internalObj, credential.password)) {
        return Promise.reject(new WrongPassword());
      }
      const existCredential = this.realm!.objectForPrimaryKey<CredentialSchema>(
        'Credential',
        credential.id,
      );
      if (existCredential) {
        return Promise.reject(
          new OneKeyInternalError(
            `${credential.id} credential has alerday exists.`,
          ),
        );
      }

      this.realm!.write(() => {
        this.realm!.create('Credential', {
          id: credential.id,
          credential: JSON.stringify({
            privateKey: credential.privateKey.toString('hex'),
          }),
        });
      });

      return Promise.resolve({ privateKey: credential.privateKey });
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
      if (!wallet) {
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
      if (!wallet) {
        return Promise.reject(new OneKeyInternalError('Wallet not found.'));
      }
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (!context) {
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

  cleanupPendingWallets(): Promise<void> {
    try {
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (context) {
        const wallets = this.realm!.objects<WalletSchema>('Wallet');
        for (const wallet of wallets) {
          if (context.pendingWallets?.has(wallet.id)) {
            const credential =
              this.realm!.objectForPrimaryKey<CredentialSchema>(
                'Credential',
                wallet.id,
              );
            this.realm!.write(() => {
              context.pendingWallets!.delete(wallet.id);
              this.realm!.delete(Array.from(wallet.accounts!));
              this.realm!.delete(wallet);
              if (credential) {
                this.realm!.delete(credential);
              }
            });
          }
        }
      }
    } catch (error: any) {
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve();
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
    skipPasswordCheck?: boolean,
  ): Promise<void> {
    try {
      const wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (!wallet) {
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
      if (!account) {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      if (wallet.type in [WALLET_TYPE_HD, WALLET_TYPE_IMPORTED]) {
        const context = this.realm!.objectForPrimaryKey<ContextSchema>(
          'Context',
          MAIN_CONTEXT,
        );
        if (!context) {
          return Promise.reject(new OneKeyInternalError('Context not found.'));
        }
        if (
          !checkPassword(context.internalObj, password) &&
          !skipPasswordCheck
        ) {
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
        if (walletIsImported(wallet.id) && credential) {
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

  removeAccounts(
    walletId: string,
    password: string | undefined | null,
  ): Promise<void> {
    try {
      const wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (!wallet) {
        return Promise.reject(
          new OneKeyInternalError(`Wallet ${walletId} not found.`),
        );
      }
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (!context) {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (wallet.type === WALLET_TYPE_HD) {
        // Only check password for HD wallet deletion.
        if (!password || !checkPassword(context.internalObj, password)) {
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
      this.realm!.write(() => {
        this.realm!.delete(Array.from(wallet.accounts!));
        if (historyEntries.length > 0) {
          this.realm!.delete(historyEntries);
        }
      });
      return Promise.resolve();
    } catch (error: any) {
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
      if (!account) {
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

  setAccountTemplate({
    accountId,
    template,
  }: ISetAccountTemplateParams): Promise<DBAccount> {
    try {
      const account = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (!account) {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      this.realm!.write(() => {
        account.template = template;
      });
      return Promise.resolve(account.internalObj);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  setAccountPub(
    accountId: string,
    pub: string,
    deletePubKey?: boolean,
  ): Promise<DBAccount> {
    try {
      const account = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (!account) {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      this.realm!.write(() => {
        account.pub = pub;
        // @ts-ignore
        if (deletePubKey && account.pubKey) {
          // @ts-ignore
          delete account.pubKey;
        }
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
  updateAccountAddresses(
    accountId: string,
    networkId: string,
    address: string,
  ): Promise<DBAccount> {
    try {
      const account = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (!account) {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      switch (account.type) {
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

  updateUTXOAccountAddresses({
    accountId,
    addresses,
    isCustomPath,
  }: {
    accountId: string;
    addresses: Record<string, string>;
    isCustomPath: boolean;
  }): Promise<DBAccount> {
    try {
      const account = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (!account) {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      switch (account.type) {
        case AccountType.UTXO:
          this.realm!.write(() => {
            Object.entries(addresses).forEach(([suffixPath, address]) => {
              if (isCustomPath) {
                account.customAddresses![suffixPath] = address;
              } else {
                account.addresses![suffixPath] = address;
              }
            });
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

  removeUTXOAccountAddresses({
    accountId,
    addresses,
    isCustomPath,
  }: {
    accountId: string;
    addresses: Record<string, string>;
    isCustomPath: boolean;
  }): Promise<DBAccount> {
    try {
      const account = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        accountId,
      );
      if (!account) {
        return Promise.reject(
          new OneKeyInternalError(`Account ${accountId} not found.`),
        );
      }
      switch (account.type) {
        case AccountType.UTXO:
          this.realm!.write(() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            Object.entries(addresses).forEach(([suffixPath, address]) => {
              if (isCustomPath) {
                if (
                  account.customAddresses &&
                  account.customAddresses[suffixPath]
                ) {
                  account.customAddresses.remove(suffixPath);
                }
              } else if (account.addresses && account.addresses[suffixPath]) {
                account.addresses.remove(suffixPath);
              }
            });
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
      if (entry) {
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
      if (contract) {
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
      if (!foundDevice) {
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
      if (!device) {
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
    if (!wallet) {
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

  addAccountDerivation({
    walletId,
    accountId,
    impl,
    template,
  }: IAddAccountDerivationParams): Promise<void> {
    const id = getAccountDerivationPrimaryKey({ walletId, impl, template });
    const accountDerivation =
      this.realm!.objectForPrimaryKey<AccountDerivationSchema>(
        'AccountDerivation',
        id,
      );
    if (!accountDerivation) {
      this.realm!.write(() => {
        this.realm!.create('AccountDerivation', {
          id,
          walletId,
          accounts: [accountId],
          template,
        });
      });
      return Promise.resolve();
    }
    const shouldSkipInsert =
      Array.isArray(accountDerivation.accounts) &&
      accountDerivation.accounts.includes(accountId);

    if (!shouldSkipInsert) {
      this.realm!.write(() => {
        accountDerivation.accounts = [
          ...new Set([...accountDerivation.accounts, accountId]),
        ];
      });
    }
    return Promise.resolve();
  }

  removeAccountDerivation({
    walletId,
    impl,
    template,
  }: {
    walletId: string;
    impl: string;
    template: string;
  }): Promise<void> {
    const id = getAccountDerivationPrimaryKey({ walletId, impl, template });
    const accountDerivation =
      this.realm!.objectForPrimaryKey<AccountDerivationSchema>(
        'AccountDerivation',
        id,
      );
    if (accountDerivation) {
      this.realm!.write(() => {
        this.realm!.delete(accountDerivation);
      });
    }
    return Promise.resolve();
  }

  removeAccountDerivationByWalletId({
    walletId,
  }: {
    walletId: string;
  }): Promise<void> {
    const accountDerivations = this.realm!.objects<AccountDerivationSchema>(
      'AccountDerivation',
    ).filtered('walletId == $0', walletId);
    this.realm!.write(() => {
      this.realm!.delete(accountDerivations);
    });
    return Promise.resolve();
  }

  removeAccountDerivationByAccountId({
    walletId,
    accountId,
  }: {
    walletId: string;
    accountId: string;
  }): Promise<void> {
    const accountDerivations = this.realm!.objects<AccountDerivationSchema>(
      'AccountDerivation',
    ).filtered('walletId == $0', walletId);
    const derivationId = accountDerivations.find(
      (accountDerivation) =>
        (accountDerivation.accounts ?? []).findIndex((id) => id === accountId) >
        -1,
    )?.id;
    if (derivationId) {
      const accountDerivation =
        this.realm!.objectForPrimaryKey<AccountDerivationSchema>(
          'AccountDerivation',
          derivationId,
        );
      this.realm!.write(() => {
        if (accountDerivation?.accounts) {
          accountDerivation.accounts = accountDerivation?.accounts.filter(
            (id) => id !== accountId,
          );
        }
      });
    }
    return Promise.resolve();
  }

  // return Record<template, record>
  getAccountDerivationByWalletId({
    walletId,
  }: {
    walletId: string;
  }): Promise<Record<string, DBAccountDerivation>> {
    const accountDerivations = this.realm!.objects<AccountDerivationSchema>(
      'AccountDerivation',
    ).filtered('walletId == $0', walletId);
    const result: Record<string, DBAccountDerivation> = {};
    accountDerivations.forEach((accountDerivation) => {
      result[accountDerivation.template] = accountDerivation.internalObj;
    });
    return Promise.resolve(result);
  }

  getCustomFee(networkId: string): Promise<IFeeInfoUnit> {
    try {
      const customFee = this.realm!.objectForPrimaryKey<CustomFeeSchema>(
        'CustomFee',
        networkId,
      );
      if (!customFee) {
        return Promise.reject(
          new OneKeyInternalError(`Custom fee of ${networkId} not found.`),
        );
      }

      return Promise.resolve(customFee.internalObj);
    } catch (error: any) {
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  updateCustomFee(
    networkId: string,
    customFee: IFeeInfoUnit | null,
  ): Promise<void> {
    try {
      const custom = this.realm!.objectForPrimaryKey<CustomFeeSchema>(
        'CustomFee',
        networkId,
      );

      if (custom) {
        if (customFee === null) {
          this.realm!.write(() => {
            this.realm!.delete(custom);
          });
        } else {
          this.realm!.write(() => {
            custom.eip1559 = customFee.eip1559;
            custom.price = customFee.price;
            // @ts-ignore
            custom.price1559 = customFee.price1559 ?? {};
            custom.isBtcForkChain = customFee.isBtcForkChain;
            custom.feeRate = customFee.feeRate;
            custom.btcFee = customFee.btcFee;
          });
        }
      } else if (customFee) {
        this.realm!.write(() => {
          this.realm!.create('CustomFee', {
            id: networkId,
            eip1559: customFee.eip1559,
            price: customFee.price,
            price1559: customFee.price1559,
            isBtcForkChain: customFee.isBtcForkChain,
            feeRate: customFee.feeRate,
            btcFee: customFee.btcFee,
          });
        });
      }
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
    return Promise.resolve();
  }

  private static addSingletonWalletEntry({
    realm,
    walletId,
  }: {
    realm: Realm;
    walletId:
      | typeof WALLET_TYPE_IMPORTED
      | typeof WALLET_TYPE_WATCHING
      | typeof WALLET_TYPE_EXTERNAL;
  }): void {
    const walletObject = realm.objectForPrimaryKey<WalletSchema>(
      'Wallet',
      walletId,
    );
    if (!walletObject) {
      realm.write(() => {
        realm.create('Wallet', {
          id: walletId,
          name: walletId,
          type: walletId,
          backuped: true,
          accounts: [],
          nextAccountIds: { 'global': 1 },
        });
      });
    }
  }
}
export { RealmDB };
