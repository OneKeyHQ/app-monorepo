/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import { Buffer } from 'buffer';

import { isNil } from 'lodash';
import RNUUID from 'react-native-uuid';

import {
  decrypt,
  encrypt,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import {
  filterPassphraseWallet,
  handleDisplayPassphraseWallet,
} from '@onekeyhq/shared/src/engine/engineUtils';

import {
  AccountAlreadyExists,
  NotImplemented,
  OneKeyAlreadyExistWalletError,
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

import type {
  DBAccount,
  DBUTXOAccount,
  DBVariantAccount,
} from '../../types/account';
import type {
  DBAccountDerivation,
  IAddAccountDerivationParams,
  ISetAccountTemplateParams,
} from '../../types/accountDerivation';
import type {
  PrivateKeyCredential,
  PrivateKeyCredentialWithId,
} from '../../types/credential';
import type { DBDevice, Device, DevicePayload } from '../../types/device';
import type {
  HistoryEntry,
  HistoryEntryMeta,
  HistoryEntryStatus,
  HistoryEntryType,
} from '../../types/history';
import type { DBNetwork, UpdateNetworkParams } from '../../types/network';
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

type TokenBinding = {
  accountId: string;
  networkId: string;
  tokenId: string;
};

require('fake-indexeddb/auto');

const DB_NAME = 'OneKey';
const DB_VERSION = 8;

const CONTEXT_STORE_NAME = 'context';
const CREDENTIAL_STORE_NAME = 'credentials';
const WALLET_STORE_NAME = 'wallets';
const ACCOUNT_STORE_NAME = 'accounts';
const NETWORK_STORE_NAME = 'networks';
const TOKEN_STORE_NAME = 'tokens';
const TOKEN_BINDING_STORE_NAME = 'token_bindings';
const HISTORY_STORE_NAME = 'history';
const DEVICE_STORE_NAME = 'devices';
const ACCOUNT_DERIVATION_STORE_NAME = 'account_derivations';
const CUSTOM_FEE_STORE_NAME = 'custom_fee';

function initDb(db: IDBDatabase) {
  db.createObjectStore(CONTEXT_STORE_NAME, { keyPath: 'id' });
  db.createObjectStore(CREDENTIAL_STORE_NAME, { keyPath: 'id' });

  const walletStore = db.createObjectStore(WALLET_STORE_NAME, {
    keyPath: 'id',
  });
  walletStore.transaction.oncomplete = (_event) => {
    db.transaction([CONTEXT_STORE_NAME], 'readwrite')
      .objectStore(CONTEXT_STORE_NAME)
      .add({
        id: MAIN_CONTEXT,
        nextHD: 1,
        verifyString: DEFAULT_VERIFY_STRING,
        backupUUID: RNUUID.v4() as string,
      });
    db.transaction([WALLET_STORE_NAME], 'readwrite')
      .objectStore(WALLET_STORE_NAME)
      .add({
        id: 'watching',
        name: 'watching',
        type: WALLET_TYPE_WATCHING,
        backuped: true,
        accounts: [],
        nextAccountIds: { 'global': 1 },
      });
  };

  db.createObjectStore(ACCOUNT_STORE_NAME, { keyPath: 'id' });

  db.createObjectStore(NETWORK_STORE_NAME, { keyPath: 'id' });

  const tokenStore = db.createObjectStore(TOKEN_STORE_NAME, { keyPath: 'id' });
  tokenStore.createIndex('networkId', 'networkId', { unique: false });
  const tokenBindingStore = db.createObjectStore(TOKEN_BINDING_STORE_NAME, {
    autoIncrement: true,
  });
  tokenBindingStore.createIndex(
    'accountId, networkId',
    ['accountId', 'networkId'],
    { unique: false },
  );
  tokenBindingStore.createIndex('tokenId', 'tokenId', { unique: false });

  const HistoryStore = db.createObjectStore(HISTORY_STORE_NAME, {
    keyPath: 'id',
  });
  HistoryStore.createIndex('accountId', 'accountId', { unique: false });
  HistoryStore.createIndex(
    'networkId, accountId, createdAt',
    ['networkId', 'accountId', 'createdAt'],
    { unique: false },
  );
}

class IndexedDBApi implements DBAPI {
  private readonly ready: Promise<IDBDatabase>;

  constructor() {
    this.ready = new Promise((resolve, reject) => {
      // eslint-disable-next-line  @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const request: IDBOpenDBRequest = indexedDB.open(DB_NAME, DB_VERSION);

      request.onsuccess = (_event) => {
        const db: IDBDatabase = request.result;
        const walletStore = db
          .transaction([WALLET_STORE_NAME], 'readwrite')
          .objectStore(WALLET_STORE_NAME);

        this.addSingletonWalletEntry({
          objectStore: walletStore,
          walletId: 'watching',
        });
        this.addSingletonWalletEntry({
          objectStore: walletStore,
          walletId: 'imported',
        });
        this.addSingletonWalletEntry({
          objectStore: walletStore,
          walletId: 'external',
        });

        resolve(request.result);
      };

      request.onerror = (_event) => {
        reject(new OneKeyInternalError('Failed to open DB.'));
      };

      request.onupgradeneeded = (versionChangedEvent) => {
        const db: IDBDatabase = request.result;
        const oldVersion = versionChangedEvent.oldVersion || 0;
        if (oldVersion < 1) {
          initDb(db);
        }
        if (oldVersion < 2) {
          db.createObjectStore(DEVICE_STORE_NAME, { keyPath: 'id' });
        }
        if (oldVersion < 5) {
          // @ts-expect-error
          const transaction = versionChangedEvent.target // @ts-expect-error
            .transaction as IDBTransaction;
          const openCursorRequest = transaction
            .objectStore(NETWORK_STORE_NAME)
            .openCursor();
          openCursorRequest.onsuccess = (_cursorEvent) => {
            const cursor = openCursorRequest.result as IDBCursorWithValue;
            if (cursor) {
              const network = cursor.value as DBNetwork;
              const toClear = DEFAULT_RPC_ENDPOINT_TO_CLEAR[network.id];
              if (!isNil(toClear) && network.rpcURL === toClear) {
                network.rpcURL = '';
                cursor.update(network);
              }
              cursor.continue();
            }
          };
        }
        if (oldVersion < 7) {
          db.createObjectStore(ACCOUNT_DERIVATION_STORE_NAME, {
            keyPath: 'id',
          });
        }

        if (oldVersion < 8) {
          db.createObjectStore(CUSTOM_FEE_STORE_NAME, {
            keyPath: 'id',
          });
        }
      };
    });
  }

  addSingletonWalletEntry({
    objectStore,
    walletId,
  }: {
    objectStore: IDBObjectStore;
    walletId:
      | typeof WALLET_TYPE_IMPORTED
      | typeof WALLET_TYPE_WATCHING
      | typeof WALLET_TYPE_EXTERNAL;
  }) {
    const walletRequest = objectStore.get(walletId);
    walletRequest.onsuccess = (_gevent) => {
      if (isNil(walletRequest.result)) {
        objectStore.add({
          id: walletId,
          name: walletId,
          type: walletId,
          backuped: true,
          accounts: [],
          nextAccountIds: { 'global': 1 },
        });
      }
    };
  }

  getContext(): Promise<OneKeyContext | null | undefined> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request = db
            .transaction([CONTEXT_STORE_NAME])
            .objectStore(CONTEXT_STORE_NAME)
            .get(MAIN_CONTEXT);
          request.onsuccess = (_event) => {
            resolve(request.result as OneKeyContext);
          };
        }),
    );
  }

  updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(
            [CONTEXT_STORE_NAME, CREDENTIAL_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to update password.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve();
          };

          const contextStore = transaction.objectStore(CONTEXT_STORE_NAME);
          const getMainContextRequest = contextStore.get(MAIN_CONTEXT);
          getMainContextRequest.onsuccess = (_event) => {
            const context = getMainContextRequest.result as OneKeyContext;
            if (!checkPassword(context, oldPassword)) {
              reject(new WrongPassword());
              return;
            }

            if (oldPassword === newPassword) {
              return;
            }

            context.verifyString = encrypt(
              newPassword,
              Buffer.from(DEFAULT_VERIFY_STRING),
            ).toString('hex');
            contextStore.put(context);
            const openCursorRequest = transaction
              .objectStore(CREDENTIAL_STORE_NAME)
              .openCursor();
            openCursorRequest.onsuccess = (_cursorEvent) => {
              const cursor: IDBCursorWithValue =
                openCursorRequest.result as IDBCursorWithValue;
              if (cursor) {
                const credentialItem: { id: string; credential: string } =
                  cursor.value as { id: string; credential: string };

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
                      decrypt(
                        oldPassword,
                        Buffer.from(credentialJSON.seed, 'hex'),
                      ),
                    ).toString('hex'),
                  });
                }

                cursor.update(credentialItem);
                cursor.continue();
              }
            };
          };
        }),
    );
  }

  reset(): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          db.close();
          const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
          deleteRequest.onerror = (_devent) => {
            reject(new OneKeyInternalError('Failed to delete db.'));
          };
          deleteRequest.onsuccess = (_devent) => {
            resolve();
          };
        }),
    );
  }

  getBackupUUID(): Promise<string> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const transaction: IDBTransaction = db.transaction(
            [CONTEXT_STORE_NAME],
            'readwrite',
          );
          const contextStore = transaction.objectStore(CONTEXT_STORE_NAME);
          const getMainContextRequest = contextStore.get(MAIN_CONTEXT);
          getMainContextRequest.onsuccess = (_event) => {
            const context = getMainContextRequest.result as OneKeyContext;
            const { backupUUID } = context;
            if (!isNil(backupUUID)) {
              resolve(backupUUID);
            } else {
              context.backupUUID = RNUUID.v4() as string;
              contextStore.put(context);
              resolve(backupUUID);
            }
          };
        }),
    );
  }

  dumpCredentials(_password: string): Promise<Record<string, string>> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request = db
            .transaction([CREDENTIAL_STORE_NAME])
            .objectStore(CREDENTIAL_STORE_NAME)
            .getAll();
          request.onsuccess = (_event) => {
            const credentials: Array<{ id: string; credential: string }> =
              request.result;

            const ret = credentials.reduce(
              (mapping, { id, credential }) =>
                Object.assign(mapping, { [id]: credential }),
              {},
            );
            resolve(ret);
          };
        }),
    );
  }

  listNetworks(): Promise<Array<DBNetwork>> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request = db
            .transaction([NETWORK_STORE_NAME])
            .objectStore(NETWORK_STORE_NAME)
            .getAll();
          request.onsuccess = (_event) => {
            const ret = request.result;
            ret.sort(
              (a, b) => (a as DBNetwork).position - (b as DBNetwork).position,
            );
            resolve(ret);
          };
        }),
    );
  }

  addNetwork(network: DBNetwork): Promise<DBNetwork> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [NETWORK_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to add network.'));
          };

          transaction.oncomplete = (_tevent) => {
            resolve(network);
          };

          const networkStore: IDBObjectStore =
            transaction.objectStore(NETWORK_STORE_NAME);
          const getNetworksRequest: IDBRequest = networkStore.getAll();

          getNetworksRequest.onsuccess = (_revent) => {
            const networks = getNetworksRequest.result as Array<DBNetwork>;

            let maxPos = 0;
            for (const v of networks) {
              maxPos = v.position > maxPos ? v.position : maxPos;

              if (v.id === network.id) {
                reject(
                  new OneKeyInternalError(
                    `Network ${network.id} already exists.`,
                  ),
                );
                return;
              }
            }
            network.position = maxPos + 1;
            networkStore.add(network);
          };
        }),
    );
  }

  getNetwork(networkId: string): Promise<DBNetwork> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const request: IDBRequest = db
            .transaction([NETWORK_STORE_NAME])
            .objectStore(NETWORK_STORE_NAME)
            .get(networkId);
          request.onsuccess = (_event) => {
            if (!isNil(request.result)) {
              resolve(request.result);
            } else {
              reject(
                new OneKeyInternalError(`Network ${networkId} not found.`),
              );
            }
          };
        }),
    );
  }

  updateNetworkList(
    networks: Array<[string, boolean]>,
    syncingDefault = false,
  ): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [NETWORK_STORE_NAME, CONTEXT_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to update network list.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve();
          };

          const statuses = new Map<string, [number, boolean]>();
          networks.forEach((element, index) =>
            statuses.set(element[0], [index + 1, element[1]]),
          );

          let orderChanged = false;
          const openCursorRequest: IDBRequest = transaction
            .objectStore(NETWORK_STORE_NAME)
            .openCursor();
          openCursorRequest.onsuccess = (_cursorEvent) => {
            const cursor: IDBCursorWithValue =
              openCursorRequest.result as IDBCursorWithValue;
            if (cursor) {
              const network: DBNetwork = cursor.value as DBNetwork;
              const status: [number, boolean] = statuses.get(network.id) || [
                -1,
                false,
              ];
              if (status[0] !== -1) {
                if (network.position !== status[0]) {
                  orderChanged = true;
                }
                [network.position, network.enabled] = status;
                cursor.update(network);
              } else {
                console.error(
                  `Network ${network.id} not specified when updating network list.`,
                );
              }
              cursor.continue();
            } else if (orderChanged && !syncingDefault) {
              const contextStore = transaction.objectStore(CONTEXT_STORE_NAME);
              const getMainContextRequest = contextStore.get(MAIN_CONTEXT);
              getMainContextRequest.onsuccess = (_cevent) => {
                const context = getMainContextRequest.result as OneKeyContext;
                if (isNil(context)) {
                  // shouldn't happen
                  console.error('Cannot get main context');
                  return;
                }
                if (
                  isNil(context.networkOrderChanged) ||
                  !context.networkOrderChanged
                ) {
                  context.networkOrderChanged = true;
                  contextStore.put(context);
                }
              };
            }
          };
        }),
    );
  }

  updateNetwork(
    networkId: string,
    params: UpdateNetworkParams,
  ): Promise<DBNetwork> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          let ret: DBNetwork;
          const transaction: IDBTransaction = db.transaction(
            [NETWORK_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to update network.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve(ret);
          };

          const networkStore: IDBObjectStore =
            transaction.objectStore(NETWORK_STORE_NAME);
          const getRequest: IDBRequest = networkStore.get(networkId);
          getRequest.onsuccess = (_event) => {
            if (!isNil(getRequest.result)) {
              const dbObj: DBNetwork = getRequest.result as DBNetwork;
              Object.assign(dbObj, params);
              networkStore.put(dbObj);
              ret = dbObj;
            } else {
              reject(
                new OneKeyInternalError(`Network ${networkId} not found.`),
              );
            }
          };
        }),
    );
  }

  deleteNetwork(networkId: string): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [NETWORK_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to delete network.'));
          };

          transaction.oncomplete = (_tevent) => {
            resolve();
          };

          transaction.objectStore(NETWORK_STORE_NAME).delete(networkId);
        }),
    );
  }

  addToken(token: Token): Promise<Token> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          let ret: Token;
          const transaction: IDBTransaction = db.transaction(
            [TOKEN_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to add token.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve(ret);
          };

          const tokenStore: IDBObjectStore =
            transaction.objectStore(TOKEN_STORE_NAME);
          const getRequest: IDBRequest = tokenStore.get(token.id);
          getRequest.onsuccess = (_event) => {
            if (isNil(getRequest.result)) {
              // only add when undefined.
              tokenStore.add(token);
              ret = token;
            } else {
              ret = getRequest.result;
            }
          };
        }),
    );
  }

  getToken(tokenId: string): Promise<Token | undefined> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request: IDBRequest = db
            .transaction([TOKEN_STORE_NAME])
            .objectStore(TOKEN_STORE_NAME)
            .get(tokenId);
          request.onsuccess = (_event) => {
            if (!isNil(request.result)) {
              resolve(request.result);
            } else {
              resolve(undefined);
            }
          };
        }),
    );
  }

  getTokens(networkId: string, accountId?: string): Promise<Array<Token>> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          if (isNil(accountId)) {
            const request: IDBRequest = db
              .transaction([TOKEN_STORE_NAME])
              .objectStore(TOKEN_STORE_NAME)
              .index('networkId')
              .getAll(IDBKeyRange.only(networkId));
            request.onsuccess = (_event) => {
              resolve(request.result);
            };
          } else {
            const transaction: IDBTransaction = db.transaction([
              TOKEN_BINDING_STORE_NAME,
              TOKEN_STORE_NAME,
            ]);

            const getBindingsRequest: IDBRequest = transaction
              .objectStore(TOKEN_BINDING_STORE_NAME)
              .index('accountId, networkId')
              .getAll(IDBKeyRange.only([accountId, networkId]));
            getBindingsRequest.onsuccess = (_gevent) => {
              const bindings: Array<TokenBinding> =
                getBindingsRequest.result as Array<TokenBinding>;
              const tokenIds = new Set(
                bindings.map(
                  (tokenBinding: TokenBinding) => tokenBinding.tokenId,
                ),
              );
              const getAllRequest: IDBRequest = transaction
                .objectStore(TOKEN_STORE_NAME)
                .getAll();
              getAllRequest.onsuccess = (_gaevent) => {
                const tokens: Array<Token> =
                  getAllRequest.result as Array<Token>;
                resolve(
                  tokens.filter((token: Token) => tokenIds.has(token.id)),
                );
              };
            };
          }
        }),
    );
  }

  addTokenToAccount(accountId: string, tokenId: string): Promise<Token> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          let token: Token;
          const transaction: IDBTransaction = db.transaction(
            [TOKEN_BINDING_STORE_NAME, TOKEN_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to add token to account.'));
          };
          transaction.oncomplete = (_tevent) => {
            if (!isNil(token)) {
              resolve(token);
            } else {
              reject(
                new OneKeyInternalError('Failed to add token to account.'),
              );
            }
          };

          const getTokenRequest: IDBRequest = transaction
            .objectStore(TOKEN_STORE_NAME)
            .get(tokenId);
          getTokenRequest.onsuccess = (_gevent) => {
            if (isNil(getTokenRequest.result)) {
              return;
            }
            token = getTokenRequest.result as Token;
            const tokenBindingStore = transaction.objectStore(
              TOKEN_BINDING_STORE_NAME,
            );
            const openCursorRequest: IDBRequest = tokenBindingStore
              .index('tokenId')
              .openCursor(IDBKeyRange.only(tokenId));
            openCursorRequest.onsuccess = (_cevent) => {
              const cursor: IDBCursorWithValue =
                openCursorRequest.result as IDBCursorWithValue;
              if (cursor) {
                if ((cursor.value as TokenBinding).accountId === accountId) {
                  // Already bound.
                  return;
                }
                cursor.continue();
              } else {
                tokenBindingStore.add({
                  accountId,
                  networkId: token.networkId,
                  tokenId,
                });
              }
            };
          };
        }),
    );
  }

  removeTokenFromAccount(accountId: string, tokenId: string): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [TOKEN_BINDING_STORE_NAME, TOKEN_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(
              new OneKeyInternalError('Failed to remove token from account.'),
            );
          };
          transaction.oncomplete = (_tevent) => {
            resolve();
          };

          const tokenBindingStore = transaction.objectStore(
            TOKEN_BINDING_STORE_NAME,
          );
          const openCursorRequest: IDBRequest = tokenBindingStore
            .index('tokenId')
            .openCursor(IDBKeyRange.only(tokenId));
          openCursorRequest.onsuccess = (_cevent) => {
            const cursor: IDBCursorWithValue =
              openCursorRequest.result as IDBCursorWithValue;
            if (cursor) {
              const tokenBinding: TokenBinding = cursor.value as TokenBinding;
              if (tokenBinding.accountId === accountId) {
                cursor.delete();
              }
              cursor.continue();
            }
          };
        }),
    );
  }

  getWallets(option?: {
    includeAllPassphraseWallet?: boolean;
    displayPassphraseWalletIds?: string[];
  }): Promise<Array<Wallet>> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          let ret: Array<Wallet> = [];
          const transaction = db.transaction(
            [
              CONTEXT_STORE_NAME,
              CREDENTIAL_STORE_NAME,
              WALLET_STORE_NAME,
              ACCOUNT_STORE_NAME,
              TOKEN_BINDING_STORE_NAME,
            ],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            console.error('Failed to cleanup pending wallets.');
            resolve(ret);
          };
          transaction.oncomplete = (_tevent) => {
            resolve(
              ret.filter((w) =>
                filterPassphraseWallet(
                  w,
                  option?.includeAllPassphraseWallet,
                  option?.displayPassphraseWalletIds,
                ),
              ),
            );
          };

          const request = transaction.objectStore(WALLET_STORE_NAME).getAll();
          request.onsuccess = (_event) => {
            const getMainContextRequest = transaction
              .objectStore(CONTEXT_STORE_NAME)
              .get(MAIN_CONTEXT);
            getMainContextRequest.onsuccess = (_cevent) => {
              const context: OneKeyContext =
                getMainContextRequest.result as OneKeyContext;
              if (!isNil(context)) {
                const pendingWallets = context.pendingWallets || [];
                ret = (request.result as Array<Wallet>).filter(
                  (wallet) => !pendingWallets.includes(wallet.id),
                );
              }
            };
          };
        }),
    );
  }

  getWallet(walletId: string): Promise<Wallet | undefined> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request: IDBRequest = db
            .transaction([WALLET_STORE_NAME])
            .objectStore(WALLET_STORE_NAME)
            .get(walletId);
          request.onsuccess = (_event) => {
            if (!isNil(request.result)) {
              resolve(request.result);
            } else {
              resolve(undefined);
            }
          };
        }),
    );
  }

  getWalletByDeviceId(deviceId: string): Promise<Array<Wallet>> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request: IDBRequest = db
            .transaction([WALLET_STORE_NAME])
            .objectStore(WALLET_STORE_NAME)
            .openCursor();

          const wallets: Wallet[] = [];
          request.onsuccess = (_event) => {
            const cursor: IDBCursorWithValue =
              request.result as IDBCursorWithValue;
            if (cursor) {
              const wallet: Wallet = cursor.value as Wallet;
              if (wallet.associatedDevice === deviceId) {
                wallets.push(wallet);
              }
              cursor.continue();
            } else {
              resolve(wallets);
            }
          };
        }),
    );
  }

  createHDWallet({
    password,
    rs,
    backuped,
    name,
    avatar,
    nextAccountIds = {},
  }: CreateHDWalletParams): Promise<Wallet> {
    let ret: Wallet;
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [CONTEXT_STORE_NAME, CREDENTIAL_STORE_NAME, WALLET_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to create HD wallet.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve(ret);
          };

          const contextStore = transaction.objectStore(CONTEXT_STORE_NAME);
          const getMainContextRequest = contextStore.get(MAIN_CONTEXT);
          getMainContextRequest.onsuccess = (_cevent) => {
            const context: OneKeyContext =
              getMainContextRequest.result as OneKeyContext;
            if (!checkPassword(context, password)) {
              reject(new WrongPassword());
              return;
            }
            const walletId = `hd-${context.nextHD}`;
            ret = {
              id: walletId,
              name: name || `Wallet ${context.nextHD}`,
              avatar,
              type: WALLET_TYPE_HD,
              backuped,
              accounts: [],
              nextAccountIds,
            };
            transaction.objectStore(WALLET_STORE_NAME).add(ret);
            transaction.objectStore(CREDENTIAL_STORE_NAME).add({
              id: walletId,
              credential: JSON.stringify({
                entropy: rs.entropyWithLangPrefixed.toString('hex'),
                seed: rs.seed.toString('hex'),
              }),
            });
            if (context.verifyString === DEFAULT_VERIFY_STRING) {
              context.verifyString = encrypt(
                password,
                Buffer.from(DEFAULT_VERIFY_STRING),
              ).toString('hex');
            }
            context.nextHD += 1;
            context.pendingWallets = [
              ...(context.pendingWallets || []),
              walletId,
            ];
            contextStore.put(context);
          };
        }),
    );
  }

  addHWWallet({
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
    let ret: Wallet;
    return this.ready.then(
      (db) =>
        // eslint-disable-next-line no-async-promise-executor
        new Promise((resolve, reject) => {
          const transaction = db.transaction(
            [
              WALLET_STORE_NAME,
              DEVICE_STORE_NAME,
              ACCOUNT_STORE_NAME,
              TOKEN_BINDING_STORE_NAME,
              HISTORY_STORE_NAME,
            ],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to add HW Wallet.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve(ret);
          };

          const deviceStore = transaction.objectStore(DEVICE_STORE_NAME);
          const walletStore = transaction.objectStore(WALLET_STORE_NAME);

          const getAllWalletsRequest = walletStore.getAll();
          getAllWalletsRequest.onsuccess = () => {
            const wallets = getAllWalletsRequest.result as Wallet[];
            const getDevicesRequest = deviceStore.getAll();

            getDevicesRequest.onsuccess = async (_devent) => {
              const devices = getDevicesRequest.result as Device[];
              const existDevice = devices.find(
                (d) => d.deviceId === deviceId && d.uuid === deviceUUID,
              );
              const hasExistWallet = wallets.find((w) => {
                if (!existDevice) return null;

                return (
                  w.associatedDevice === existDevice?.id &&
                  w.passphraseState === passphraseState
                );
              });

              if (hasExistWallet) {
                if (passphraseState) {
                  handleDisplayPassphraseWallet(hasExistWallet.id);
                  ret = hasExistWallet;
                }
                reject(
                  new OneKeyAlreadyExistWalletError(
                    hasExistWallet.id,
                    hasExistWallet.name,
                  ),
                );
                return;
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
                  deviceStore,
                );
              }

              const deviceTableId = existDevice ? existDevice.id : id;
              let walletId = `hw-${deviceTableId}`;
              if (passphraseState) {
                walletId = `hw-${deviceTableId}-${passphraseState}`;
              }

              const getNewDeviceRequest = deviceStore.get(deviceTableId);
              getNewDeviceRequest.onsuccess = () => {
                const newDevice = getNewDeviceRequest.result as Device;
                if (isNil(newDevice)) {
                  throw new OneKeyInternalError(
                    `Device ${deviceUUID} not found.`,
                  );
                }

                const getWalletRequest = walletStore.get(walletId);
                getWalletRequest.onsuccess = (_wevent) => {
                  const wallet = getWalletRequest?.result as Wallet | undefined;

                  if (wallet && !passphraseState) {
                    reject(
                      new OneKeyAlreadyExistWalletError(wallet.id, wallet.name),
                    );
                    return;
                  }

                  if (!wallet) {
                    ret = {
                      id: walletId,
                      name,
                      avatar,
                      type: WALLET_TYPE_HW,
                      backuped: true,
                      accounts: [],
                      nextAccountIds: {},
                      associatedDevice: deviceTableId,
                      deviceType,
                      passphraseState,
                    };
                    walletStore.add(ret);
                  }

                  if (passphraseState) {
                    if (wallet) {
                      ret = wallet;
                    }

                    // update wallet state, display wallet
                    if (ret) {
                      handleDisplayPassphraseWallet(ret.id);
                    }
                  }
                };
              };
            };
          };
        }),
    );
  }

  removeWallet(walletId: string, password: string): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [
              CONTEXT_STORE_NAME,
              CREDENTIAL_STORE_NAME,
              WALLET_STORE_NAME,
              ACCOUNT_STORE_NAME,
              TOKEN_BINDING_STORE_NAME,
              HISTORY_STORE_NAME,
              DEVICE_STORE_NAME,
            ],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to remove wallet.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve();
          };

          const walletStore = transaction.objectStore(WALLET_STORE_NAME);
          const getWalletRequest = walletStore.get(walletId);
          getWalletRequest.onsuccess = (_wevent) => {
            const wallet = getWalletRequest.result as Wallet;
            if (isNil(wallet)) {
              reject(new OneKeyInternalError(`Wallet ${walletId} not found.`));
              return;
            }
            if (
              (wallet.type as string) !== WALLET_TYPE_HD &&
              (wallet.type as string) !== WALLET_TYPE_HW
            ) {
              reject(
                new OneKeyInternalError('Only HD or HW wallet can be removed.'),
              );
              return;
            }

            const deleteWallet = (removeDevice = true) => {
              const getMainContextRequest = transaction
                .objectStore(CONTEXT_STORE_NAME)
                .get(MAIN_CONTEXT);
              getMainContextRequest.onsuccess = (_cevent) => {
                const context: OneKeyContext =
                  getMainContextRequest.result as OneKeyContext;
                if (wallet.type === WALLET_TYPE_HD) {
                  // Only check password for HD wallet deletion.
                  if (!checkPassword(context, password)) {
                    reject(new WrongPassword());
                    return;
                  }
                } else if (wallet.associatedDevice && removeDevice) {
                  walletStore.transaction
                    .objectStore(DEVICE_STORE_NAME)
                    .delete(wallet.associatedDevice);
                }

                const { accounts } = wallet;
                accounts.forEach((accountId) => {
                  this.cleanupAccount(transaction, wallet, accountId);
                });
                walletStore.delete(walletId);
                transaction.objectStore(CREDENTIAL_STORE_NAME).delete(walletId);
              };
            };

            if (wallet.type === WALLET_TYPE_HW) {
              const walletRequest: IDBRequest = transaction
                .objectStore(WALLET_STORE_NAME)
                .openCursor();

              const wallets: Wallet[] = [];
              walletRequest.onsuccess = (_event) => {
                const cursor: IDBCursorWithValue =
                  walletRequest.result as IDBCursorWithValue;

                if (cursor) {
                  const deviceWallet: Wallet = cursor.value as Wallet;
                  if (
                    deviceWallet.associatedDevice === wallet.associatedDevice
                  ) {
                    wallets.push(wallet);
                  }
                  cursor.continue();
                } else {
                  const deleteDevice = wallets.length <= 1;
                  deleteWallet(deleteDevice);
                }
              };
            } else {
              deleteWallet(false);
            }
          };
        }),
    );
  }

  setWalletNameAndAvatar(
    walletId: string,
    { name, avatar }: SetWalletNameAndAvatarParams,
  ): Promise<Wallet> {
    let ret: Wallet;
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [WALLET_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to set wallet name.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve(ret);
          };

          const walletStore = transaction.objectStore(WALLET_STORE_NAME);
          const getWalletRequest = walletStore.get(walletId);
          getWalletRequest.onsuccess = (_wevent) => {
            const wallet = getWalletRequest.result as Wallet;
            if (isNil(wallet)) {
              reject(new OneKeyInternalError(`Wallet ${walletId} not found.`));
              return;
            }
            if (
              (wallet.type as string) !== WALLET_TYPE_HD &&
              (wallet.type as string) !== WALLET_TYPE_HW
            ) {
              reject(
                new OneKeyInternalError(
                  'Only HD or HW wallet name can be set.',
                ),
              );
              return;
            }
            if (name) {
              wallet.name = name;
            }
            if (avatar) {
              wallet.avatar = avatar;
            }
            ret = wallet;
            walletStore.put(wallet);
          };
        }),
    );
  }

  updateWalletNextAccountIds({
    walletId,
    nextAccountIds,
  }: ISetNextAccountIdsParams): Promise<Wallet> {
    let ret: Wallet;
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [WALLET_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to set wallet name.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve(ret);
          };

          const walletStore = transaction.objectStore(WALLET_STORE_NAME);
          const getWalletRequest = walletStore.get(walletId);
          getWalletRequest.onsuccess = (_wevent) => {
            const wallet = getWalletRequest.result as Wallet;
            if (isNil(wallet)) {
              reject(new OneKeyInternalError(`Wallet ${walletId} not found.`));
              return;
            }
            if (
              (wallet.type as string) !== WALLET_TYPE_HD &&
              (wallet.type as string) !== WALLET_TYPE_HW
            ) {
              reject(
                new OneKeyInternalError(
                  'Only HD or HW wallet name can be set.',
                ),
              );
              return;
            }
            wallet.nextAccountIds = nextAccountIds;
            ret = wallet;
            walletStore.put(wallet);
          };
        }),
    );
  }

  getCredential(
    credentialId: string, // walletId || acountId
    password: string,
  ): Promise<ExportedCredential> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction([
            CONTEXT_STORE_NAME,
            CREDENTIAL_STORE_NAME,
          ]);
          const getMainContextRequest = transaction
            .objectStore(CONTEXT_STORE_NAME)
            .get(MAIN_CONTEXT);
          getMainContextRequest.onsuccess = (_cevent) => {
            const context: OneKeyContext =
              getMainContextRequest.result as OneKeyContext;
            if (!checkPassword(context, password)) {
              reject(new WrongPassword());
              return;
            }
            const getCredentialRequest = transaction
              .objectStore(CREDENTIAL_STORE_NAME)
              .get(credentialId);
            getCredentialRequest.onsuccess = (_creevent) => {
              if (isNil(getCredentialRequest.result)) {
                reject(
                  new OneKeyInternalError(
                    `Cannot find seed of wallet ${credentialId}.`,
                  ),
                );
                return;
              }

              const { credential } = getCredentialRequest.result as {
                id: string;
                credential: string;
              };

              if (walletIsImported(credentialId)) {
                const privateKeyCredentialJSON = JSON.parse(
                  credential,
                ) as StoredPrivateKeyCredential;
                resolve({
                  privateKey: Buffer.from(
                    privateKeyCredentialJSON.privateKey,
                    'hex',
                  ),
                });
              } else {
                const seedCredentialJSON = JSON.parse(
                  credential,
                ) as StoredSeedCredential;
                resolve({
                  entropy: Buffer.from(seedCredentialJSON.entropy, 'hex'),
                  seed: Buffer.from(seedCredentialJSON.seed, 'hex'),
                });
              }
            };
          };
        }),
    );
  }

  createPrivateKeyCredential(
    credential: PrivateKeyCredentialWithId,
  ): Promise<ExportedPrivateKeyCredential> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          if (!credential) {
            reject(new OneKeyInternalError('Credential required.'));
            return;
          }
          const transaction = db.transaction(
            [CONTEXT_STORE_NAME, CREDENTIAL_STORE_NAME],
            'readwrite',
          );
          const getMainContextRequest = transaction
            .objectStore(CONTEXT_STORE_NAME)
            .get(MAIN_CONTEXT);
          getMainContextRequest.onsuccess = (_cevent) => {
            const context: OneKeyContext =
              getMainContextRequest.result as OneKeyContext;
            if (!checkPassword(context, credential.password)) {
              reject(new WrongPassword());
              return;
            }
            const getCredentialRequest = transaction
              .objectStore(CREDENTIAL_STORE_NAME)
              .get(credential.id);
            getCredentialRequest.onsuccess = (_creevent) => {
              if (getCredentialRequest.result) {
                reject(
                  new OneKeyInternalError(
                    `${credential.id} credential has alerday exists.`,
                  ),
                );
                return;
              }
              transaction.objectStore(CREDENTIAL_STORE_NAME).put({
                id: credential.id,
                credential: JSON.stringify({
                  privateKey: credential.privateKey.toString('hex'),
                }),
              });
              return resolve({
                privateKey: credential.privateKey,
              });
            };
          };
        }),
    );
  }

  confirmHDWalletBackuped(walletId: string): Promise<Wallet> {
    let ret: Wallet;
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [WALLET_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(
              new OneKeyInternalError('Failed to confirm HD wallet backup.'),
            );
          };
          transaction.oncomplete = (_tevent) => {
            resolve(ret);
          };

          const walletStore = transaction.objectStore(WALLET_STORE_NAME);
          const getWalletRequest = walletStore.get(walletId);
          getWalletRequest.onsuccess = (_wevent) => {
            const wallet = getWalletRequest.result as Wallet;
            if (isNil(wallet)) {
              reject(new OneKeyInternalError(`Wallet ${walletId} not found.`));
              return;
            }
            if (wallet.type !== WALLET_TYPE_HD) {
              reject(
                new OneKeyInternalError(
                  `Wallet ${walletId} is not an HD wallet.`,
                ),
              );
              return;
            }
            if (wallet.backuped !== true) {
              wallet.backuped = true;
              walletStore.put(wallet);
            }
            ret = wallet;
          };
        }),
    );
  }

  confirmWalletCreated(walletId: string): Promise<Wallet> {
    let ret: Wallet;
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [CONTEXT_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(
              new OneKeyInternalError('Failed to confirm HD wallet created.'),
            );
          };
          transaction.oncomplete = (_tevent) => {
            resolve(ret);
          };

          const contextStore = transaction.objectStore(CONTEXT_STORE_NAME);
          const getMainContextRequest = contextStore.get(MAIN_CONTEXT);
          getMainContextRequest.onsuccess = (_cevent) => {
            const context: OneKeyContext =
              getMainContextRequest.result as OneKeyContext;
            if ((context.pendingWallets || []).includes(walletId)) {
              context.pendingWallets = (context.pendingWallets || []).filter(
                (pendingId) => pendingId !== walletId,
              );
              contextStore.put(context);
            }

            const getWalletRequest = db
              .transaction([WALLET_STORE_NAME])
              .objectStore(WALLET_STORE_NAME)
              .get(walletId);
            getWalletRequest.onsuccess = (_event) => {
              const wallet = getWalletRequest.result as Wallet;
              if (isNil(wallet)) {
                reject(
                  new OneKeyInternalError(`Wallet ${walletId} not found.`),
                );
                return;
              }
              ret = wallet;
            };
          };
        }),
    );
  }

  cleanupPendingWallets(): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const transaction = db.transaction(
            [
              CONTEXT_STORE_NAME,
              CREDENTIAL_STORE_NAME,
              WALLET_STORE_NAME,
              ACCOUNT_STORE_NAME,
              TOKEN_BINDING_STORE_NAME,
            ],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            console.error('Failed to cleanup pending wallets.');
            resolve();
          };
          transaction.oncomplete = (_tevent) => {
            resolve();
          };

          const request = transaction.objectStore(WALLET_STORE_NAME).getAll();
          request.onsuccess = (_event) => {
            const getMainContextRequest = transaction
              .objectStore(CONTEXT_STORE_NAME)
              .get(MAIN_CONTEXT);
            getMainContextRequest.onsuccess = (_cevent) => {
              const context: OneKeyContext =
                getMainContextRequest.result as OneKeyContext;
              if (!isNil(context)) {
                const pendingWallets = context.pendingWallets || [];
                if (pendingWallets.length > 0) {
                  context.pendingWallets = [];
                  transaction.objectStore(CONTEXT_STORE_NAME).put(context);
                }
                // Then do the cleanup
                const walletStore = transaction.objectStore(WALLET_STORE_NAME);
                for (const walletId of pendingWallets) {
                  const getWalletRequest = walletStore.get(walletId);
                  getWalletRequest.onsuccess = (_wevent) => {
                    const wallet = getWalletRequest.result as Wallet;
                    if (!isNil(wallet)) {
                      walletStore.delete(walletId);
                      transaction
                        .objectStore(CREDENTIAL_STORE_NAME)
                        .delete(walletId);
                      wallet.accounts.forEach((accountId) => {
                        transaction
                          .objectStore(ACCOUNT_STORE_NAME)
                          .delete(accountId);
                      });
                      const openCursorRequest = transaction
                        .objectStore(TOKEN_BINDING_STORE_NAME)
                        .openCursor();
                      openCursorRequest.onsuccess = (_cursorEvent) => {
                        const cursor: IDBCursorWithValue =
                          openCursorRequest.result as IDBCursorWithValue;
                        if (cursor) {
                          if (
                            wallet.accounts.includes(
                              (cursor.value as TokenBinding).accountId,
                            )
                          ) {
                            cursor.delete();
                          }
                          cursor.continue();
                        }
                      };
                    }
                  };
                }
              }
            };
          };
        }),
    );
  }

  addAccountToWallet(
    walletId: string,
    account: DBAccount,
    importedCredential?: PrivateKeyCredential,
  ): Promise<DBAccount> {
    const addingImported = walletIsImported(walletId);

    let ret: DBAccount;
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [
              WALLET_STORE_NAME,
              ACCOUNT_STORE_NAME,
              ACCOUNT_DERIVATION_STORE_NAME,
            ].concat(
              addingImported ? [CONTEXT_STORE_NAME, CREDENTIAL_STORE_NAME] : [],
            ),
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to add account to wallet.'));
          };
          transaction.oncomplete = (_tevent) => {
            if (!isNil(ret)) {
              resolve(ret);
            } else {
              reject(
                new OneKeyInternalError('Failed to add account to wallet.'),
              );
            }
          };

          const walletStore: IDBObjectStore =
            transaction.objectStore(WALLET_STORE_NAME);
          const accountDerivationStore = transaction.objectStore(
            ACCOUNT_DERIVATION_STORE_NAME,
          );
          const getWalletRequest: IDBRequest = walletStore.get(walletId);
          getWalletRequest.onsuccess = async (_gevent) => {
            if (getWalletRequest.result === 'undefined') {
              reject(new OneKeyInternalError(`Wallet ${walletId} not found.`));
              return;
            }
            const wallet = getWalletRequest.result as Wallet;
            if (wallet.accounts.includes(account.id)) {
              reject(new AccountAlreadyExists());
              return;
            }

            wallet.accounts.push(account.id);

            switch (wallet.type) {
              case WALLET_TYPE_WATCHING: {
                if (wallet.accounts.length > WATCHING_ACCOUNT_MAX_NUM) {
                  reject(new TooManyWatchingAccounts(WATCHING_ACCOUNT_MAX_NUM));
                  return;
                }
                wallet.nextAccountIds.global += 1;
                break;
              }
              case WALLET_TYPE_EXTERNAL: {
                if (wallet.accounts.length > EXTERNAL_ACCOUNT_MAX_NUM) {
                  reject(new TooManyExternalAccounts(EXTERNAL_ACCOUNT_MAX_NUM));
                  return;
                }
                wallet.nextAccountIds.global += 1;
                break;
              }
              case WALLET_TYPE_HW:
              // fall through
              case WALLET_TYPE_HD: {
                const pathComponents = account.path.split('/');
                const category = `${pathComponents[1]}/${pathComponents[2]}`;
                const purpose = pathComponents[1].slice(0, -1);
                const coinType = pathComponents[2].slice(0, -1);

                // Check account number limit
                const accountIdPrefix = `${walletId}--m/${category}`;
                if (
                  wallet.accounts.filter((id) => id.startsWith(accountIdPrefix))
                    .length > DERIVED_ACCOUNT_MAX_NUM
                ) {
                  reject(
                    new TooManyDerivedAccounts(
                      DERIVED_ACCOUNT_MAX_NUM,
                      parseInt(coinType),
                      parseInt(purpose),
                    ),
                  );
                  return;
                }

                if (!account.template) {
                  reject(
                    new OneKeyInternalError(
                      `Account should has template field`,
                    ),
                  );
                  return;
                }
                const impl = getImplByCoinType(account.coinType);
                await this.addAccountDerivation({
                  walletId: wallet.id,
                  accountId: account.id,
                  impl,
                  template: account.template,
                  derivationStore: accountDerivationStore,
                });
                const template = account.template ?? '';
                const accountDerivation = await this.getAccountDerivationRecord(
                  wallet.id,
                  impl,
                  account.template,
                  accountDerivationStore,
                );
                let nextId = wallet.nextAccountIds[template] || 0;
                nextId = getNextAccountIdsWithAccountDerivation(
                  accountDerivation,
                  nextId,
                  purpose,
                  coinType,
                );
                wallet.nextAccountIds[template] = nextId;

                break;
              }
              case WALLET_TYPE_IMPORTED: {
                const getMainContextRequest = transaction
                  .objectStore(CONTEXT_STORE_NAME)
                  .get(MAIN_CONTEXT);
                getMainContextRequest.onsuccess = (_cevent) => {
                  if (wallet.accounts.length > IMPORTED_ACCOUNT_MAX_NUM) {
                    reject(
                      new TooManyImportedAccounts(IMPORTED_ACCOUNT_MAX_NUM),
                    );
                    return;
                  }
                  const context: OneKeyContext =
                    getMainContextRequest.result as OneKeyContext;
                  if (!importedCredential) {
                    reject(
                      new OneKeyInternalError(
                        'Imported credential required for adding imported accounts.',
                      ),
                    );
                    return;
                  }
                  if (!checkPassword(context, importedCredential.password)) {
                    reject(new WrongPassword());
                    return;
                  }
                  transaction.objectStore(CREDENTIAL_STORE_NAME).add({
                    id: account.id,
                    credential: JSON.stringify({
                      privateKey:
                        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        importedCredential.privateKey.toString('hex'),
                    }),
                  });
                  if (context.verifyString === DEFAULT_VERIFY_STRING) {
                    context.verifyString = encrypt(
                      importedCredential.password,
                      Buffer.from(DEFAULT_VERIFY_STRING),
                    ).toString('hex');
                    transaction.objectStore(CONTEXT_STORE_NAME).put(context);
                  }
                  wallet.nextAccountIds.global += 1;
                  walletStore.put(wallet);
                  transaction
                    .objectStore(ACCOUNT_STORE_NAME)
                    .add(account).onsuccess = (_aevent) => {
                    ret = account;
                  };
                };
                break;
              }
              default:
                reject(new NotImplemented());
                return;
            }

            if (addingImported) {
              // wallet and account should be updated/added if password check passed.
              return;
            }

            walletStore.put(wallet);
            transaction.objectStore(ACCOUNT_STORE_NAME).add(account).onsuccess =
              (_aevent) => {
                ret = account;
              };
          };
        }),
    );
  }

  getAllAccounts(): Promise<Array<DBAccount>> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request = db
            .transaction([ACCOUNT_STORE_NAME])
            .objectStore(ACCOUNT_STORE_NAME)
            .getAll();
          request.onsuccess = (_event) => {
            resolve(request.result as Array<DBAccount>);
          };
        }),
    );
  }

  getAccounts(accountIds: Array<string>): Promise<Array<DBAccount>> {
    const idsSet = new Set(accountIds);
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request: IDBRequest = db
            .transaction([ACCOUNT_STORE_NAME])
            .objectStore(ACCOUNT_STORE_NAME)
            .getAll();
          request.onsuccess = (_event) => {
            resolve(
              (request.result as Array<DBAccount>).filter(
                (dbAccount: DBAccount) => idsSet.has(dbAccount.id),
              ),
            );
          };
        }),
    );
  }

  getAccountByAddress({
    address,
    coinType,
  }: {
    address: string;
    coinType?: string;
  }): Promise<DBAccount> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const request: IDBRequest = db
            .transaction([ACCOUNT_STORE_NAME])
            .objectStore(ACCOUNT_STORE_NAME)
            .openCursor();

          request.onsuccess = (_event) => {
            const cursor: IDBCursorWithValue =
              request.result as IDBCursorWithValue;

            if (cursor) {
              const account = cursor.value as DBAccount | undefined;
              let isFound = account && account?.address === address;
              if (coinType) {
                isFound = isFound && account?.coinType === coinType;
              }
              if (account && isFound) {
                resolve(account);
              } else {
                cursor.continue();
              }
            } else {
              reject(new OneKeyInternalError(`Account ${address} not found.`));
            }
          };
        }),
    );
  }

  getAccount(accountId: string): Promise<DBAccount> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const request: IDBRequest = db
            .transaction([ACCOUNT_STORE_NAME])
            .objectStore(ACCOUNT_STORE_NAME)
            .get(accountId);
          request.onsuccess = (_event) => {
            if (!isNil(request.result)) {
              resolve(request.result);
            } else {
              reject(
                new OneKeyInternalError(`Account ${accountId} not found.`),
              );
            }
          };
        }),
    );
  }

  private cleanupAccount(
    transaction: IDBTransaction,
    wallet: Wallet,
    accountId: string,
  ): void {
    wallet.accounts = wallet.accounts.filter(
      (aId: string) => aId !== accountId,
    );
    transaction.objectStore(WALLET_STORE_NAME).put(wallet);

    transaction.objectStore(ACCOUNT_STORE_NAME).delete(accountId);

    if (walletIsImported(wallet.id)) {
      transaction.objectStore(CREDENTIAL_STORE_NAME).delete(accountId);
    }

    const tokenBindingOpenCursorRequest = transaction
      .objectStore(TOKEN_BINDING_STORE_NAME)
      .index('accountId, networkId')
      .openCursor(IDBKeyRange.bound([accountId], [accountId, []]));
    tokenBindingOpenCursorRequest.onsuccess = (_cevent) => {
      const cursor = tokenBindingOpenCursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    const historyOpenCursorRequest = transaction
      .objectStore(HISTORY_STORE_NAME)
      .index('accountId')
      .openCursor(IDBKeyRange.only(accountId));
    historyOpenCursorRequest.onsuccess = (_cevent) => {
      const cursor = historyOpenCursorRequest.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }

  removeAccount(
    walletId: string,
    accountId: string,
    password: string,
    rollbackNextAccountIds: Record<string, number>,
    skipPasswordCheck?: boolean,
  ): Promise<void> {
    const removingImported = walletIsImported(walletId);
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(
            [
              CONTEXT_STORE_NAME,
              WALLET_STORE_NAME,
              ACCOUNT_STORE_NAME,
              TOKEN_BINDING_STORE_NAME,
              HISTORY_STORE_NAME,
            ].concat(removingImported ? [CREDENTIAL_STORE_NAME] : []),
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to remove account.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve();
          };

          const walletStore = transaction.objectStore(WALLET_STORE_NAME);
          const getWalletRequest = walletStore.get(walletId);
          getWalletRequest.onsuccess = (_wevent) => {
            const wallet = getWalletRequest.result as Wallet;
            if (isNil(wallet) || !wallet.accounts.includes(accountId)) {
              reject(
                new OneKeyInternalError(
                  'Failed to remove account, wallet or account not found.',
                ),
              );
              return;
            }

            if (
              [WALLET_TYPE_HD, WALLET_TYPE_IMPORTED].includes(
                wallet.type as string,
              )
            ) {
              const getMainContextRequest = transaction
                .objectStore(CONTEXT_STORE_NAME)
                .get(MAIN_CONTEXT);
              getMainContextRequest.onsuccess = (_cevent) => {
                const context: OneKeyContext =
                  getMainContextRequest.result as OneKeyContext;
                if (!checkPassword(context, password) && !skipPasswordCheck) {
                  reject(new WrongPassword());
                  return;
                }
                this.cleanupAccount(transaction, wallet, accountId);
              };
            } else {
              this.cleanupAccount(transaction, wallet, accountId);
            }

            let needUpdateWallet = false;
            const { nextAccountIds } = wallet;
            for (const [category, index] of Object.entries(
              rollbackNextAccountIds,
            )) {
              if (nextAccountIds[category] === index + 1) {
                // Roll back next account id;
                nextAccountIds[category] = index;
                needUpdateWallet = true;
              }
            }
            if (needUpdateWallet) {
              wallet.nextAccountIds = nextAccountIds;
              walletStore.put(wallet);
            }
          };
        }),
    );
  }

  setAccountName(accountId: string, name: string): Promise<DBAccount> {
    let ret: DBAccount;
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction([ACCOUNT_STORE_NAME], 'readwrite');
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to set account name.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve(ret);
          };

          const accountStore = transaction.objectStore(ACCOUNT_STORE_NAME);
          const getAccountRequest = accountStore.get(accountId);
          getAccountRequest.onsuccess = (_aevent) => {
            const account = getAccountRequest.result as DBAccount;
            if (isNil(account)) {
              reject(
                new OneKeyInternalError(`Account ${accountId} not found.`),
              );
              return;
            }
            account.name = name;
            ret = account;
            accountStore.put(account);
          };
        }),
    );
  }

  setAccountTemplate({
    accountId,
    template,
  }: ISetAccountTemplateParams): Promise<DBAccount> {
    let ret: DBAccount;
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction([ACCOUNT_STORE_NAME], 'readwrite');
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to set account name.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve(ret);
          };

          const accountStore = transaction.objectStore(ACCOUNT_STORE_NAME);
          const getAccountRequest = accountStore.get(accountId);
          getAccountRequest.onsuccess = (_aevent) => {
            const account = getAccountRequest.result as DBAccount;
            if (isNil(account)) {
              reject(
                new OneKeyInternalError(`Account ${accountId} not found.`),
              );
              return;
            }
            account.template = template;
            ret = account;
            accountStore.put(account);
          };
        }),
    );
  }

  setAccountPub(
    accountId: string,
    pub: string,
    deletePubKey?: boolean,
  ): Promise<DBAccount> {
    let ret: DBAccount;
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction([ACCOUNT_STORE_NAME], 'readwrite');
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to set account name.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve(ret);
          };

          const accountStore = transaction.objectStore(ACCOUNT_STORE_NAME);
          const getAccountRequest = accountStore.get(accountId);
          getAccountRequest.onsuccess = (_aevent) => {
            const account = getAccountRequest.result as DBAccount;
            if (isNil(account)) {
              reject(
                new OneKeyInternalError(`Account ${accountId} not found.`),
              );
              return;
            }
            // there may be wrong and useless 'pubKey' in btc account
            // need to be deleted
            // @ts-ignore
            if (deletePubKey && account.pubKey) {
              // @ts-ignore
              delete account.pubKey;
            }
            account.pub = pub;
            ret = account;
            accountStore.put(account);
          };
        }),
    );
  }

  updateAccountAddresses(
    accountId: string,
    networkId: string,
    address: string,
  ): Promise<DBAccount> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const accountStore = db
            .transaction([ACCOUNT_STORE_NAME], 'readwrite')
            .objectStore(ACCOUNT_STORE_NAME);
          const getAccountRequest = accountStore.get(accountId);
          getAccountRequest.onsuccess = (_aevent) => {
            const account = getAccountRequest.result as DBAccount;
            if (isNil(account)) {
              reject(
                new OneKeyInternalError(`Account ${accountId} not found.`),
              );
              return;
            }
            switch (account.type) {
              case AccountType.VARIANT:
                if (isNil((account as DBVariantAccount).addresses)) {
                  (account as DBVariantAccount).addresses = {};
                }
                (account as DBVariantAccount).addresses[networkId] = address;
                break;
              default:
                reject(new NotImplemented());
                return;
            }
            accountStore.put(account);
            resolve(account);
          };
        }),
    );
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
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const accountStore = db
            .transaction([ACCOUNT_STORE_NAME], 'readwrite')
            .objectStore(ACCOUNT_STORE_NAME);
          const getAccountRequest = accountStore.get(accountId);
          getAccountRequest.onsuccess = (_aevent) => {
            const account = getAccountRequest.result as DBAccount;
            let utxoAccount: DBUTXOAccount;
            if (isNil(account)) {
              reject(
                new OneKeyInternalError(`Account ${accountId} not found.`),
              );
              return;
            }
            switch (account.type) {
              case AccountType.UTXO:
                utxoAccount = account as DBUTXOAccount;
                Object.entries(addresses).forEach(([suffixPath, address]) => {
                  if (isCustomPath) {
                    if (!utxoAccount.customAddresses) {
                      utxoAccount.customAddresses = {};
                    }
                    utxoAccount.customAddresses[suffixPath] = address;
                  } else {
                    utxoAccount.addresses[suffixPath] = address;
                  }
                });
                break;
              default:
                reject(new NotImplemented());
                return;
            }
            if (utxoAccount) {
              accountStore.put(utxoAccount);
            }
            resolve(utxoAccount);
          };
        }),
    );
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
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const accountStore = db
            .transaction([ACCOUNT_STORE_NAME], 'readwrite')
            .objectStore(ACCOUNT_STORE_NAME);
          const getAccountRequest = accountStore.get(accountId);
          getAccountRequest.onsuccess = (_aevent) => {
            const account = getAccountRequest.result as DBAccount;
            let utxoAccount: DBUTXOAccount;
            if (isNil(account)) {
              reject(
                new OneKeyInternalError(`Account ${accountId} not found.`),
              );
              return;
            }
            switch (account.type) {
              case AccountType.UTXO:
                utxoAccount = account as DBUTXOAccount;
                Object.keys(addresses).forEach((suffixPath) => {
                  if (isCustomPath) {
                    if (
                      utxoAccount.customAddresses &&
                      utxoAccount.customAddresses[suffixPath]
                    ) {
                      delete utxoAccount.customAddresses[suffixPath];
                    }
                  } else if (
                    utxoAccount.addresses &&
                    utxoAccount.addresses[suffixPath]
                  ) {
                    delete utxoAccount.addresses[suffixPath];
                  }
                });
                break;
              default:
                reject(new NotImplemented());
                return;
            }
            if (utxoAccount) {
              accountStore.put(utxoAccount);
            }
            resolve(utxoAccount);
          };
        }),
    );
  }

  addHistoryEntry(
    id: string,
    networkId: string,
    accountId: string,
    type: HistoryEntryType,
    status: HistoryEntryStatus,
    meta: HistoryEntryMeta,
  ): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction([HISTORY_STORE_NAME], 'readwrite');
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to add history entry.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve();
          };

          const now = Date.now();
          transaction.objectStore(HISTORY_STORE_NAME).add({
            id,
            networkId,
            accountId,
            status,
            type,
            createdAt: now,
            updatedAt: now,
            ...meta,
          });
        }),
    );
  }

  updateHistoryEntryStatuses(
    statusMap: Record<string, HistoryEntryStatus>,
  ): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction([HISTORY_STORE_NAME], 'readwrite');
          transaction.onerror = (_tevent) => {
            reject(
              new OneKeyInternalError(
                'Failed to update History Entry statuses.',
              ),
            );
          };
          transaction.oncomplete = (_tevent) => {
            resolve();
          };

          const historyStore = transaction.objectStore(HISTORY_STORE_NAME);
          const updatedAt = Date.now();

          Object.entries(statusMap).forEach(([entryId, status]) => {
            const getRequest = historyStore.get(entryId);
            getRequest.onsuccess = (_event) => {
              if (!isNil(getRequest.result)) {
                historyStore.put(
                  Object.assign(getRequest.result, { status, updatedAt }),
                );
              }
            };
          });
        }),
    );
  }

  removeHistoryEntry(entryId: string): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction([HISTORY_STORE_NAME], 'readwrite');
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to add history entry.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve();
          };

          transaction.objectStore(HISTORY_STORE_NAME).delete(entryId);
        }),
    );
  }

  getHistory(
    limit: number,
    networkId: string,
    accountId: string,
    contract?: string,
    before?: number,
  ): Promise<Array<HistoryEntry>> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const ret: Array<HistoryEntry> = [];
          const transaction = db.transaction([HISTORY_STORE_NAME], 'readwrite');
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to add history entry.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve(ret);
          };

          const openCursorRequest = transaction
            .objectStore(HISTORY_STORE_NAME)
            .index('networkId, accountId, createdAt')
            .openCursor(
              IDBKeyRange.bound(
                [networkId, accountId],
                [networkId, accountId, before || Date.now()],
              ),
              'prev',
            );

          openCursorRequest.onsuccess = (_cevent) => {
            const cursor = openCursorRequest.result as IDBCursorWithValue;
            if (cursor) {
              const entry = cursor.value as HistoryEntry;
              const contractInEntry = (entry as { contract: string }).contract;
              if (
                isNil(contract) ||
                (!isNil(contractInEntry) && contract === contractInEntry)
              ) {
                ret.push(cursor.value as HistoryEntry);
              }
              if (ret.length < limit) {
                cursor.continue();
              }
            }
          };
        }),
    );
  }

  private insertDevice(
    id: string,
    name: string,
    mac: string,
    uuid: string,
    deviceId: string,
    deviceType: IDeviceType,
    features: string,
    deviceStore: IDBObjectStore,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = deviceStore.get(id);
      request.onsuccess = (_event) => {
        const device = request.result as Device;
        const now = Date.now();
        /**
         * insert only for device
         */
        if (isNil(device)) {
          const addDeviceRequest = deviceStore.add({
            id,
            name,
            mac,
            uuid,
            deviceId,
            deviceType,
            features,
            payloadJson: '{}',
            createdAt: now,
            updatedAt: now,
          });
          addDeviceRequest.onsuccess = () => resolve();
          addDeviceRequest.onerror = () =>
            reject(new OneKeyInternalError(`Failed to create device.`));
        } else {
          reject(new OneKeyInternalError(`Device ${name} has alerday exists.`));
        }
      };
    });
  }

  getDevices(): Promise<Array<Device>> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request = db
            .transaction([DEVICE_STORE_NAME])
            .objectStore(DEVICE_STORE_NAME)
            .getAll();
          request.onsuccess = (_event) => {
            const devices = request.result.map((device) =>
              fromDBDeviceToDevice(device),
            );
            resolve(devices);
          };
        }),
    );
  }

  getDevice(deviceId: string): Promise<Device> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const request: IDBRequest = db
            .transaction([DEVICE_STORE_NAME])
            .objectStore(DEVICE_STORE_NAME)
            .get(deviceId);
          request.onsuccess = (_event) => {
            if (!isNil(request.result)) {
              resolve(fromDBDeviceToDevice(request.result));
            } else {
              reject(new OneKeyInternalError(`Device ${deviceId} not found.`));
            }
          };
        }),
    );
  }

  getDeviceByDeviceId(deviceId: string): Promise<Device> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const request: IDBRequest = db
            .transaction([DEVICE_STORE_NAME])
            .objectStore(DEVICE_STORE_NAME)
            .getAll();

          request.onsuccess = (_event) => {
            if (!isNil(request.result)) {
              const ret = request.result as Array<DBDevice>;
              const device = ret.find((item) => item.deviceId === deviceId);

              if (device) resolve(fromDBDeviceToDevice(device));

              reject(new OneKeyInternalError(`Device ${deviceId} not found.`));
            } else {
              reject(new OneKeyInternalError(`Device ${deviceId} not found.`));
            }
          };
        }),
    );
  }

  updateWalletName(walletId: string, name: string): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(
            [WALLET_STORE_NAME, DEVICE_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = () => {
            reject(new OneKeyInternalError('Failed to update wallet name.'));
          };
          transaction.oncomplete = () => {
            resolve();
          };

          const walletStore = transaction.objectStore(WALLET_STORE_NAME);
          const getWalletRequest: IDBRequest<Wallet> =
            walletStore.get(walletId);
          getWalletRequest.onsuccess = () => {
            const wallet = getWalletRequest.result;
            if (isNil(wallet)) {
              reject(new OneKeyInternalError('Wallet not found.'));
              return;
            }
            walletStore.put(Object.assign(wallet, { name }));
            if (!wallet.associatedDevice) {
              return;
            }
            const deviceStore = transaction.objectStore(DEVICE_STORE_NAME);
            const getDeviceRequest: IDBRequest<Device> = deviceStore.get(
              wallet.associatedDevice,
            );
            getDeviceRequest.onsuccess = () => {
              const device = getDeviceRequest.result;
              if (isNil(device)) {
                reject(new OneKeyInternalError('Device not found.'));
                return;
              }
              deviceStore.put(Object.assign(device, { name }));
            };
          };
        }),
    );
  }

  updateDevicePayload(deviceId: string, payload: DevicePayload): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction([DEVICE_STORE_NAME], 'readwrite');
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to update device.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve();
          };

          const deviceStore = transaction.objectStore(DEVICE_STORE_NAME);
          const request = deviceStore.getAll();

          request.onsuccess = (_event) => {
            if (!isNil(request.result)) {
              const devices = request.result as Array<DBDevice>;
              const device = devices.find((item) => item.deviceId === deviceId);
              if (device) {
                const oldPayload = fromDBDeviceToDevice(device).payload;
                const newPayload = JSON.stringify({
                  ...oldPayload,
                  ...payload,
                });

                deviceStore.put(
                  Object.assign(device, {
                    payloadJson: newPayload,
                    updatedAt: Date.now(),
                  }),
                );
              } else {
                reject(
                  new OneKeyInternalError(`Device ${deviceId} not found.`),
                );
              }
            }
          };
        }),
    );
  }

  addAccountDerivation({
    walletId,
    accountId,
    impl,
    template,
    derivationStore,
  }: IAddAccountDerivationParams): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          let accountDerivationStore: IDBObjectStore;
          if (!derivationStore) {
            const transaction = db.transaction(
              [ACCOUNT_DERIVATION_STORE_NAME],
              'readwrite',
            );
            transaction.onerror = () => {
              reject(
                new OneKeyInternalError('Failed to add account derivation.'),
              );
            };

            accountDerivationStore = transaction.objectStore(
              ACCOUNT_DERIVATION_STORE_NAME,
            );
          } else {
            accountDerivationStore = derivationStore;
          }

          const accountDerivationId = getAccountDerivationPrimaryKey({
            walletId,
            impl,
            template,
          });
          const getExistRecordRequest: IDBRequest<DBAccountDerivation> =
            accountDerivationStore.get(accountDerivationId);
          getExistRecordRequest.onsuccess = (_event) => {
            const accountDerivation = getExistRecordRequest.result;
            if (accountDerivation) {
              // skip update record when accountId already exist
              if (
                Array.isArray(accountDerivation.accounts) &&
                accountDerivation.accounts.includes(accountId)
              ) {
                resolve();
                return;
              }
              accountDerivation.accounts = [
                ...new Set([...accountDerivation.accounts, accountId]),
              ];
              const requestUpdate =
                accountDerivationStore.put(accountDerivation);
              requestUpdate.onerror = (event) => {
                reject(event);
              };
              requestUpdate.onsuccess = () => {
                resolve();
              };
            } else {
              // insert new accountDerivation record because is not exist record
              const requestInsert = accountDerivationStore.add({
                id: accountDerivationId,
                walletId,
                accounts: [accountId],
                template,
              });

              requestInsert.onerror = (event) => {
                reject(event);
              };
              requestInsert.onsuccess = () => {
                resolve();
              };
            }
          };
        }),
    );
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
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(
            [ACCOUNT_DERIVATION_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = () => {
            reject(
              new OneKeyInternalError(
                'Failed to delete account derivation by account id.',
              ),
            );
          };
          transaction.oncomplete = () => {
            resolve();
          };

          const accountDerivationStore = transaction.objectStore(
            ACCOUNT_DERIVATION_STORE_NAME,
          );

          const accountDerivationId = getAccountDerivationPrimaryKey({
            walletId,
            impl,
            template,
          });
          const getExistRecordRequest: IDBRequest<DBAccountDerivation> =
            accountDerivationStore.get(accountDerivationId);
          getExistRecordRequest.onsuccess = (_event) => {
            const accountDerivation = getExistRecordRequest.result;
            if (accountDerivation) {
              accountDerivationStore.delete(accountDerivation.id);
            }
          };
        }),
    );
  }

  removeAccountDerivationByWalletId({
    walletId,
  }: {
    walletId: string;
  }): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(
            [ACCOUNT_DERIVATION_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = () => {
            reject(
              new OneKeyInternalError(
                'Failed to delete account derivation by wallet id.',
              ),
            );
          };
          transaction.oncomplete = () => {
            resolve();
          };

          const accountDerivationStore = transaction.objectStore(
            ACCOUNT_DERIVATION_STORE_NAME,
          );

          const request: IDBRequest<DBAccountDerivation[]> =
            accountDerivationStore.getAll();
          request.onsuccess = (_event) => {
            if (!isNil(request.result)) {
              const accountDerivations = request.result;
              accountDerivations.forEach((accountDerivation) => {
                if (accountDerivation.walletId === walletId) {
                  accountDerivationStore.delete(accountDerivation.id);
                }
              });
            }
          };
        }),
    );
  }

  removeAccountDerivationByAccountId({
    walletId,
    accountId,
  }: {
    walletId: string;
    accountId: string;
  }): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(
            [ACCOUNT_DERIVATION_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = () => {
            reject(
              new OneKeyInternalError(
                'Failed to delete account derivation by account id.',
              ),
            );
          };
          transaction.oncomplete = () => {
            resolve();
          };

          const accountDerivationStore = transaction.objectStore(
            ACCOUNT_DERIVATION_STORE_NAME,
          );

          const request: IDBRequest<DBAccountDerivation[]> =
            accountDerivationStore.getAll();
          request.onsuccess = (_event) => {
            if (!isNil(request.result)) {
              const accountDerivations = request.result;
              accountDerivations.forEach((accountDerivation) => {
                if (accountDerivation.walletId === walletId) {
                  accountDerivation.accounts =
                    accountDerivation.accounts.filter(
                      (id: string) => id !== accountId,
                    );
                  accountDerivationStore.put(accountDerivation);
                }
              });
            }
          };
        }),
    );
  }

  // return Record<template, record>
  getAccountDerivationByWalletId({
    walletId,
  }: {
    walletId: string;
  }): Promise<Record<string, DBAccountDerivation>> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(
            [ACCOUNT_DERIVATION_STORE_NAME],
            'readonly',
          );
          transaction.onerror = () => {
            reject(
              new OneKeyInternalError(
                'Failed to get account derivation by wallet id.',
              ),
            );
          };

          const accountDerivationStore = transaction.objectStore(
            ACCOUNT_DERIVATION_STORE_NAME,
          );

          const request: IDBRequest<DBAccountDerivation[]> =
            accountDerivationStore.getAll();
          request.onsuccess = (_event) => {
            if (!isNil(request.result)) {
              const accountDerivations = request.result;
              const result = accountDerivations
                .filter((item) => item.walletId === walletId)
                .reduce((acc, item) => {
                  acc[item.template] = item;
                  return acc;
                }, {} as Record<string, DBAccountDerivation>);
              resolve(result);
            }
          };
        }),
    );
  }

  private getAccountDerivationRecord(
    walletId: string,
    impl: string,
    template: string,
    derivationStore: IDBObjectStore,
  ): Promise<DBAccountDerivation> {
    return new Promise((resolve, reject) => {
      const id = getAccountDerivationPrimaryKey({ walletId, impl, template });
      const getExistRecordRequest = derivationStore.get(id);
      getExistRecordRequest.onsuccess = (_event) => {
        if (isNil(getExistRecordRequest.result)) {
          reject(new OneKeyInternalError(`AccountDerivation ${id} not found.`));
        }
        const accountDerivation = getExistRecordRequest.result;
        resolve(accountDerivation);
      };
    });
  }

  getCustomFee(networkId: string): Promise<IFeeInfoUnit | undefined> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request: IDBRequest = db
            .transaction([CUSTOM_FEE_STORE_NAME], 'readonly')
            .objectStore(CUSTOM_FEE_STORE_NAME)
            .get(networkId);
          request.onsuccess = (_event) => {
            if (!isNil(request.result)) {
              resolve(request.result);
            } else {
              resolve(undefined);
            }
          };
        }),
    );
  }

  updateCustomFee(
    networkId: string,
    customFee: IFeeInfoUnit | null | undefined,
  ): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(
            [CUSTOM_FEE_STORE_NAME],
            'readwrite',
          );

          const objectStore = transaction.objectStore(CUSTOM_FEE_STORE_NAME);

          if (customFee) {
            const request = objectStore.put({
              ...customFee,
              id: networkId,
            });
            request.onsuccess = () => {
              resolve();
            };

            request.onerror = () => {
              reject(
                new OneKeyInternalError(
                  `Update custom fee failed for ${networkId}`,
                ),
              );
            };
          } else if (customFee === null) {
            const request = objectStore.delete(networkId);
            request.onsuccess = () => {
              resolve();
            };

            request.onerror = () => {
              reject(
                new OneKeyInternalError(
                  `Delete custom fee failed for ${networkId}`,
                ),
              );
            };
          }
        }),
    );
  }
}

export { IndexedDBApi };
