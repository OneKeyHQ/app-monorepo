/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import { Buffer } from 'buffer';

import { RevealableSeed } from '@onekeyfe/blockchain-libs/dist/secret';

import {
  AccountAlreadyExists,
  NotImplemented,
  OneKeyInternalError,
  WrongPassword,
} from '../../errors';
import {
  ACCOUNT_TYPE_SIMPLE,
  DBAccount,
  DBSimpleAccount,
} from '../../types/account';
import {
  HistoryEntry,
  HistoryEntryMeta,
  HistoryEntryStatus,
  HistoryEntryType,
} from '../../types/history';
import { DBNetwork, UpdateNetworkParams } from '../../types/network';
import { Token } from '../../types/token';
import {
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
  Wallet,
} from '../../types/wallet';
import {
  DBAPI,
  DEFAULT_VERIFY_STRING,
  ExportedCredential,
  MAIN_CONTEXT,
  OneKeyContext,
  StoredCredential,
  checkPassword,
  decrypt,
  encrypt,
} from '../base';

type TokenBinding = {
  accountId: string;
  networkId: string;
  tokenId: string;
};

require('fake-indexeddb/auto');

const DB_NAME = 'OneKey';
const DB_VERSION = 1;

const CONTEXT_STORE_NAME = 'context';
const CREDENTIAL_STORE_NAME = 'credentials';
const WALLET_STORE_NAME = 'wallets';
const ACCOUNT_STORE_NAME = 'accounts';
const NETWORK_STORE_NAME = 'networks';
const TOKEN_STORE_NAME = 'tokens';
const TOKEN_BINDING_STORE_NAME = 'token_bindings';
const HISTORY_STORE_NAME = 'history';

function initDb(request: IDBOpenDBRequest) {
  const db: IDBDatabase = request.result;

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

      request.onerror = (_event) => {
        reject(new OneKeyInternalError('Failed to open DB.'));
      };

      request.onupgradeneeded = () => {
        initDb(request);
      };

      request.onsuccess = (_event) => {
        const transaction: IDBTransaction = request.result.transaction(
          [NETWORK_STORE_NAME],
          'readwrite',
        );
        transaction.onerror = (_tevent) => {
          reject(new OneKeyInternalError('Failed to sync db.'));
        };

        transaction.oncomplete = (_tevent) => {
          resolve(request.result);
        };
      };
    });
  }

  getContext(): Promise<OneKeyContext | undefined> {
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
                const credentialJSON: StoredCredential = JSON.parse(
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
          const getNetworkIdsRequest: IDBRequest = networkStore.getAllKeys();

          getNetworkIdsRequest.onsuccess = (_revent) => {
            const networkIds = new Set(getNetworkIdsRequest.result);
            if (networkIds.has(network.id)) {
              reject(
                new OneKeyInternalError(
                  `Network ${network.id} already exists.`,
                ),
              );
              return;
            }
            network.position = networkIds.size;
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
            if (typeof request.result !== 'undefined') {
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

  updateNetworkList(networks: Array<[string, boolean]>): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [NETWORK_STORE_NAME],
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
            statuses.set(element[0], [index, element[1]]),
          );

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
                [network.position, network.enabled] = status;
                cursor.update(network);
              } else {
                console.error(
                  `Network ${network.id} not specified when updating network list.`,
                );
              }
              cursor.continue();
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
            if (typeof getRequest.result !== 'undefined') {
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
            if (typeof getRequest.result === 'undefined') {
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
            if (typeof request.result !== 'undefined') {
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
          if (typeof accountId === 'undefined') {
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
            if (typeof token !== 'undefined') {
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
            if (typeof getTokenRequest.result === 'undefined') {
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
          let bindings = 0;
          let removed = false;
          openCursorRequest.onsuccess = (_cevent) => {
            const cursor: IDBCursorWithValue =
              openCursorRequest.result as IDBCursorWithValue;
            if (cursor) {
              const tokenBinding: TokenBinding = cursor.value as TokenBinding;
              if (tokenBinding.accountId === accountId) {
                removed = true;
                cursor.delete();
              }
              bindings += 1;
              cursor.continue();
            } else if (bindings === 1 && removed) {
              transaction.objectStore(TOKEN_STORE_NAME).delete(tokenId);
            }
          };
        }),
    );
  }

  getWallets(): Promise<Array<Wallet>> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request: IDBRequest = db
            .transaction([WALLET_STORE_NAME])
            .objectStore(WALLET_STORE_NAME)
            .getAll();
          request.onsuccess = (_event) => {
            resolve(request.result as Array<Wallet>);
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
            if (typeof request.result !== 'undefined') {
              resolve(request.result);
            } else {
              resolve(undefined);
            }
          };
        }),
    );
  }

  createHDWallet(
    password: string,
    rs: RevealableSeed,
    name?: string,
  ): Promise<Wallet> {
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
              name: name || `HD Wallet ${context.nextHD}`,
              type: WALLET_TYPE_HD,
              backuped: false,
              accounts: [],
              nextAccountIds: {},
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
              context.nextHD += 1;
              contextStore.put(context);
            }
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
            if (typeof wallet === 'undefined') {
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
              walletStore.delete(walletId);
              transaction.objectStore(CREDENTIAL_STORE_NAME).delete(walletId);
              wallet.accounts.forEach((accountId) => {
                transaction.objectStore(ACCOUNT_STORE_NAME).delete(accountId);
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
            };
          };
        }),
    );
  }

  setWalletName(walletId: string, name: string): Promise<Wallet> {
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
            if (typeof wallet === 'undefined') {
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
            wallet.name = name;
            ret = wallet;
            walletStore.put(wallet);
          };
        }),
    );
  }

  getCredential(
    walletId: string,
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
              .get(walletId);
            getCredentialRequest.onsuccess = (_creevent) => {
              if (typeof getCredentialRequest.result === 'undefined') {
                reject(
                  new OneKeyInternalError(
                    `Cannot find seed of wallet ${walletId}.`,
                  ),
                );
                return;
              }
              const credentialJSON: StoredCredential = JSON.parse(
                (
                  getCredentialRequest.result as {
                    id: string;
                    credential: string;
                  }
                ).credential,
              );
              resolve({
                entropy: Buffer.from(credentialJSON.entropy, 'hex'),
                seed: Buffer.from(credentialJSON.seed, 'hex'),
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
            if (typeof wallet === 'undefined') {
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

  addAccountToWallet(walletId: string, account: DBAccount): Promise<DBAccount> {
    let ret: DBAccount;
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction: IDBTransaction = db.transaction(
            [WALLET_STORE_NAME, ACCOUNT_STORE_NAME],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to add account to wallet.'));
          };
          transaction.oncomplete = (_tevent) => {
            if (typeof ret !== 'undefined') {
              resolve(ret);
            } else {
              reject(
                new OneKeyInternalError('Failed to add account to wallet.'),
              );
            }
          };

          const walletStore: IDBObjectStore =
            transaction.objectStore(WALLET_STORE_NAME);
          const getWalletRequest: IDBRequest = walletStore.get(walletId);
          getWalletRequest.onsuccess = (_gevent) => {
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

            if (wallet.type === WALLET_TYPE_WATCHING) {
              wallet.nextAccountIds.global += 1;
            } else if (wallet.type === WALLET_TYPE_HD) {
              const pathComponents = account.path.split('/');
              const category = `${pathComponents[1]}/${pathComponents[2]}`;
              let nextId = wallet.nextAccountIds[category] || 0;
              while (
                wallet.accounts.includes(
                  `${walletId}--${pathComponents
                    .slice(0, -1)
                    .concat([nextId.toString()])
                    .join('/')}`,
                )
              ) {
                nextId += 1;
              }
              wallet.nextAccountIds[category] = nextId;
            } else {
              // TODO: other wallets.
              reject(new NotImplemented());
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

  getAccount(accountId: string): Promise<DBAccount | undefined> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request: IDBRequest = db
            .transaction([ACCOUNT_STORE_NAME])
            .objectStore(ACCOUNT_STORE_NAME)
            .get(accountId);
          request.onsuccess = (_event) => {
            if (typeof request.result !== 'undefined') {
              resolve(request.result);
            } else {
              resolve(undefined);
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

    const tokenBindingOpenCursorRequest = transaction
      .objectStore(TOKEN_BINDING_STORE_NAME)
      .index('accountId, networkId')
      .openCursor(IDBKeyRange.bound([accountId], [accountId]));
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
  ): Promise<void> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, reject) => {
          const transaction = db.transaction(
            [
              CONTEXT_STORE_NAME,
              WALLET_STORE_NAME,
              ACCOUNT_STORE_NAME,
              TOKEN_BINDING_STORE_NAME,
            ],
            'readwrite',
          );
          transaction.onerror = (_tevent) => {
            reject(new OneKeyInternalError('Failed to remove account.'));
          };
          transaction.oncomplete = (_tevent) => {
            resolve();
          };

          const getWalletRequest = transaction
            .objectStore(WALLET_STORE_NAME)
            .get(walletId);
          getWalletRequest.onsuccess = (_wevent) => {
            const wallet = getWalletRequest.result as Wallet;
            if (
              typeof wallet === 'undefined' ||
              !wallet.accounts.includes(accountId)
            ) {
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
                if (!checkPassword(context, password)) {
                  reject(new WrongPassword());
                  return;
                }
                this.cleanupAccount(transaction, wallet, accountId);
              };
            } else {
              this.cleanupAccount(transaction, wallet, accountId);
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
            if (typeof account === 'undefined') {
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

  addAccountAddress(
    accountId: string,
    _networkId: string,
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
            if (typeof account === 'undefined') {
              reject(
                new OneKeyInternalError(`Account ${accountId} not found.`),
              );
              return;
            }
            if (account.type !== ACCOUNT_TYPE_SIMPLE) {
              reject(new NotImplemented());
              return;
            }
            (account as DBSimpleAccount).address = address;
            accountStore.put(account);
            resolve(account);
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
              if (typeof getRequest.result !== 'undefined') {
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
              if (
                typeof contract === 'undefined' ||
                contract === entry.contract
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
}

export { IndexedDBApi };
