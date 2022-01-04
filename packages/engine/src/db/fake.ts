/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import { Buffer } from 'buffer';

import {
  RevealableSeed,
  mnemonicFromEntropy,
} from '@onekeyhq/blockchain-libs/dist/secret';
import {
  decrypt,
  encrypt,
} from '@onekeyhq/blockchain-libs/dist/secret/encryptors/aes256';

import {
  AccountAlreadyExists,
  OneKeyInternalError,
  WrongPassword,
} from '../errors';
import { presetNetworks } from '../presets';
import { DBAccount } from '../types/account';
import { DBNetwork, UpdateNetworkParams } from '../types/network';
import { Token } from '../types/token';
import {
  DBWallet,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_WATCHING,
} from '../types/wallet';

import { DBAPI } from './base';

type TokenBinding = {
  accountId: string;
  networkId: string;
  tokenId: string;
};

type OneKeyContext = {
  id: string;
  nextHD: number;
  verifyString: string;
};

require('fake-indexeddb/auto');

const DB_NAME = 'OneKey';
const DB_VERSION = 1;
const MAIN_CONTEXT = 'mainContext';
const DEFAULT_VERIFY_STRING = 'OneKey';

const CONTEXT_STORE_NAME = 'context';
const CREDENTIAL_STORE_NAME = 'credentials';
const WALLET_STORE_NAME = 'wallets';
const ACCOUNT_STORE_NAME = 'accounts';
const NETWORK_STORE_NAME = 'networks';
const TOKEN_STORE_NAME = 'tokens';
const TOKEN_BINDING_STORE_NAME = 'token_bindings';

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
        nextAccountId: { 'global': 1 },
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
}

function checkPassword(context: OneKeyContext, password: string): boolean {
  if (typeof context === 'undefined') {
    console.error('Unable to get main context.');
    return false;
  }
  if (context.verifyString === DEFAULT_VERIFY_STRING) {
    return true;
  }
  try {
    return (
      decrypt(password, Buffer.from(context.verifyString, 'hex')).toString() ===
      DEFAULT_VERIFY_STRING
    );
  } catch {
    return false;
  }
}

class FakeDB implements DBAPI {
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

        const networkStore: IDBObjectStore =
          transaction.objectStore(NETWORK_STORE_NAME);
        const getNetworkIdsRequest: IDBRequest = networkStore.getAllKeys();

        getNetworkIdsRequest.onsuccess = (_revent) => {
          const networkIds = new Set(getNetworkIdsRequest.result);
          let position = networkIds.size;
          // TODO: also sync networks from remote.
          Object.values(presetNetworks).forEach((network) => {
            if (networkIds.has(network.id)) {
              return;
            }
            networkStore.add({
              id: network.id,
              name: network.name,
              impl: network.impl,
              symbol: network.symbol,
              logoURI: network.logoURI,
              feeSymbol: network.feeSymbol,
              decimals: network.decimals,
              feeDecimals: network.feeDecimals,
              balance2FeeDecimals: network.balance2FeeDecimals,
              rpcURL: network.presetRpcURLs[0],
              enabled: network.enabled,
              position,
            });
            position += 1;
            networkIds.add(network.id);
          });
        };
      };
    });
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

  getWallets(): Promise<Array<DBWallet>> {
    return this.ready.then(
      (db) =>
        new Promise((resolve, _reject) => {
          const request: IDBRequest = db
            .transaction([WALLET_STORE_NAME])
            .objectStore(WALLET_STORE_NAME)
            .getAll();
          request.onsuccess = (_event) => {
            resolve(request.result as Array<DBWallet>);
          };
        }),
    );
  }

  getWallet(walletId: string): Promise<DBWallet | undefined> {
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
  ): Promise<DBWallet> {
    let ret: DBWallet;
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
              nextAccountId: {},
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
            const wallet = getWalletRequest.result as DBWallet;
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

  setWalletName(walletId: string, name: string): Promise<DBWallet> {
    let ret: DBWallet;
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
            const wallet = getWalletRequest.result as DBWallet;
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

  revealHDWalletSeed(walletId: string, password: string): Promise<string> {
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
              const { entropy } = JSON.parse(
                (
                  getCredentialRequest.result as {
                    id: string;
                    credential: string;
                  }
                ).credential,
              );
              resolve(
                mnemonicFromEntropy(Buffer.from(entropy, 'hex'), password),
              );
            };
          };
        }),
    );
  }

  confirmHDWalletBackuped(walletId: string): Promise<DBWallet> {
    let ret: DBWallet;
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
            const wallet = getWalletRequest.result as DBWallet;
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
            const wallet = getWalletRequest.result as DBWallet;
            if (wallet.accounts.includes(account.id)) {
              reject(new AccountAlreadyExists());
              return;
            }
            if (wallet.type !== WALLET_TYPE_WATCHING) {
              // TODO: other wallets.
              reject(new OneKeyInternalError('Not implemented.'));
              return;
            }

            account.name =
              account.name || `Watching ${wallet.nextAccountId.global}`;
            wallet.accounts.push(account.id);
            wallet.nextAccountId.global += 1;
            walletStore.put(wallet);
            transaction.objectStore(ACCOUNT_STORE_NAME).add(account).onsuccess =
              (_aevent) => {
                ret = account;
              };
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
}

export { FakeDB };
