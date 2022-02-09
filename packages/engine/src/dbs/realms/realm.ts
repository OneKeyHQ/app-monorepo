/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Buffer } from 'buffer';

import Realm from 'realm';

import { RevealableSeed } from '@onekeyhq/blockchain-libs/dist/secret';

import {
  NotImplemented,
  OneKeyInternalError,
  WrongPassword,
} from '../../errors';
import { presetNetworksList } from '../../presets';
import { ACCOUNT_TYPE_SIMPLE, DBAccount } from '../../types/account';
import { DBNetwork } from '../../types/network';
import { Token } from '../../types/token';
import {
  DBWallet,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '../../types/wallet';
import {
  DBAPI,
  DEFAULT_VERIFY_STRING,
  ExportedCredential,
  MAIN_CONTEXT,
  StoredCredential,
  checkPassword,
  encrypt,
} from '../base';

import {
  AccountSchema,
  ContextSchema,
  CredentialSchema,
  NetworkSchema,
  TokenSchema,
  WalletSchema,
} from './schemas';

const DB_PATH = 'OneKey.realm';
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
      ],
    })
      .then((realm) => {
        if (update || realm.empty) {
          realm.write(() => {
            presetNetworksList.forEach((network, index) => {
              realm.create(
                'Network',
                {
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
                  preset: true,
                  position: index,
                },
                Realm.UpdateMode.Modified,
              );
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

  /**
   * reset the storage, all data will be removed
   * @param password
   */
  reset(password: string): Promise<void> {
    try {
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        MAIN_CONTEXT,
      );
      if (typeof context !== 'undefined') {
        if (!checkPassword(context, password)) {
          return Promise.reject(new WrongPassword());
        }
      }
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
      this.realm!.objects<NetworkSchema>('Network').sorted('position', true);
    return Promise.resolve(networks as unknown as DBNetwork[]);
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
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.realm!.objects<NetworkSchema>('Network').max(
          'position',
        ) as unknown as number;
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
    return Promise.resolve(network as unknown as DBNetwork);
  }

  /**
   * update network list.
   * @param networks list of tuples of network id and enabled flag
   * @returns {Promise<void>}
   * @throws {OneKeyInternalError}
   * @NOTE: networks must include all networks exist
   */
  updateNetworkList(networks: [string, boolean][]): Promise<void> {
    try {
      const size = this.realm!.objects<NetworkSchema>('Network').length;
      if (networks.length !== size) {
        return Promise.reject(
          new OneKeyInternalError(
            `Network list length not match, expected ${size} but got ${networks.length}`,
          ),
        );
      }
      this.realm!.write(() => {
        networks.forEach(([id, enabled], position) => {
          this.realm!.create(
            'Network',
            {
              id,
              enabled,
              position,
            },
            Realm.UpdateMode.Modified,
          );
        });
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
      });
      return Promise.resolve(network as unknown as DBNetwork);
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
        return Promise.reject(
          new OneKeyInternalError(`Token ${token.id} already exist.`),
        );
      }
      this.realm!.write(() => {
        this.realm!.create('Token', {
          id: token.id,
          name: token.name,
          tokenIdOnNetwork: token.tokenIdOnNetwork,
          symbol: token.symbol,
          decimals: token.decimals,
          networkId: token.networkId,
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
      return Promise.resolve(token as unknown as Token);
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
          'network_id = $0',
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
        tokens = account.tokens?.filtered('networkId = $0', networkId);
      }
      return Promise.resolve(tokens as unknown as Token[]);
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
      return Promise.resolve(token as unknown as Token);
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
        if (account.tokens?.includes(token)) {
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
   * @returns {Promise<DBWallet[]>}
   */
  getWallets(): Promise<DBWallet[]> {
    try {
      const wallets = this.realm!.objects<DBWallet>('Wallet');
      return Promise.resolve(wallets as unknown as DBWallet[]);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * get a certain wallet by id
   * @param walletId
   * @returns {Promise<DBWallet | undefined>}
   * @throws {OneKeyInternalError}
   */
  getWallet(walletId: string): Promise<DBWallet | undefined> {
    try {
      const wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        return Promise.resolve(undefined);
      }
      return Promise.resolve(wallet as unknown as DBWallet);
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
  addAccountToWallet(walletId: string, account: DBAccount): Promise<DBAccount> {
    try {
      let wallet = this.realm!.objectForPrimaryKey<WalletSchema>(
        'Wallet',
        walletId,
      );
      if (typeof wallet === 'undefined') {
        if (walletId !== 'watching') {
          return Promise.reject(
            new OneKeyInternalError(`Wallet ${walletId} not found.`),
          );
        }
      }
      const accountFind = this.realm!.objectForPrimaryKey<AccountSchema>(
        'Account',
        account.id,
      );
      if (typeof accountFind !== 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Account ${account.id} already exist.`),
        );
      }
      this.realm!.write(() => {
        // if wallet is not exist, create it, type must be watching
        if (typeof wallet === 'undefined') {
          wallet = this.realm!.create('Wallet', {
            id: 'watching',
            name: 'watching',
            type: WALLET_TYPE_WATCHING,
            backuped: true,
            accounts: [],
            nextAccountIds: { 'global': 1 },
          });
        }
        const accountNew = this.realm!.create<AccountSchema>('Account', {
          id: account.id,
          name: account.name,
          type: account.type,
          path: account.path,
          coinType: account.coinType,
          // @ts-ignore
          pub: account.pub,
          // @ts-ignore
          address: account.address,
        });
        wallet.accounts!.add(accountNew);
        if (wallet.type === WALLET_TYPE_WATCHING) {
          wallet.nextAccountIds!.global += 1;
        } else if (wallet.type === WALLET_TYPE_HD) {
          const pathComponents = account.path.split('/');
          const category = `${pathComponents[1]}/${pathComponents[2]}`;
          let nextId = wallet.nextAccountIds![category] || 0;
          while (
            wallet.accounts!.filtered(
              'id = $0',
              `${walletId}--${pathComponents
                .slice(0, -1)
                .concat([nextId.toString()])
                .join('/')}`,
            )?.length > 0
          ) {
            nextId += 1;
          }
          wallet.nextAccountIds![category] = nextId;
        }
      });
      return Promise.resolve(account as unknown as DBAccount);
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
        'id IN $0',
        accountIds,
      );
      return Promise.resolve(accounts as unknown as DBAccount[]);
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
      return Promise.resolve(account as unknown as DBAccount);
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
  createHDWallet(
    password: string,
    rs: RevealableSeed,
    name?: string,
  ): Promise<DBWallet> {
    let context: ContextSchema | undefined;
    try {
      context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        'mainContext',
      );
      if (typeof context === 'undefined') {
        this.realm!.write(() => {
          context = this.realm!.create('Context', {
            id: 'mainContext',
            verifyString: DEFAULT_VERIFY_STRING,
            nextHD: 1,
          });
        });
      } else if (!checkPassword(context, password)) {
        return Promise.reject(new WrongPassword());
      }
      const walletId = `hd-${context!.nextHD}`;
      let wallet: WalletSchema | undefined;
      this.realm!.write(() => {
        wallet = this.realm!.create('Wallet', {
          id: walletId,
          name: name || `HD Wallet ${context!.nextHD}`,
          type: WALLET_TYPE_HD,
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
      });
      // in order to disable lint error, here wallet is undefined is impossible ??
      if (typeof wallet === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError('Wallet creation failed.'),
        );
      }
      console.log('wallet created==', wallet);
      return Promise.resolve(wallet as unknown as DBWallet);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
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
        'mainContext',
      );
      if (typeof context === 'undefined') {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (!checkPassword(context, password)) {
        return Promise.reject(new WrongPassword());
      }
      const credential = this.realm!.objectForPrimaryKey<CredentialSchema>(
        'Credential',
        walletId,
      );
      this.realm!.write(() => {
        // associate accounts will automatically keep track the deletion ????
        this.realm!.delete(wallet.accounts);
        this.realm!.delete(wallet);
        if (typeof credential !== 'undefined') {
          this.realm!.delete(credential);
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
   * @returns {Promise<DBWallet>}
   * @throws {OneKeyInternalError}
   */
  setWalletName(walletId: string, name: string): Promise<DBWallet> {
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
        wallet.name = name;
      });
      return Promise.resolve(wallet as unknown as DBWallet);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   * retrieve the stored credential of a wallet
   * @param walletId
   * @param password
   * @returns {Promise<ExportedCredential>}
   * @throws {OneKeyInternalError, WrongPassword}
   * @NOTE: this method is only used for hd wallet
   */
  getCredential(
    walletId: string,
    password: string,
  ): Promise<ExportedCredential> {
    try {
      const context = this.realm!.objectForPrimaryKey<ContextSchema>(
        'Context',
        'mainContext',
      );
      if (typeof context === 'undefined') {
        return Promise.reject(new OneKeyInternalError('Context not found.'));
      }
      if (!checkPassword(context, password)) {
        return Promise.reject(new WrongPassword());
      }
      const credential = this.realm!.objectForPrimaryKey<CredentialSchema>(
        'Credential',
        walletId,
      );
      if (typeof credential === 'undefined') {
        return Promise.reject(
          new OneKeyInternalError(`Credential ${walletId} not found.`),
        );
      }
      const credentialJSON: StoredCredential = JSON.parse(
        credential.credential,
      );
      return Promise.resolve({
        entropy: Buffer.from(credentialJSON.entropy, 'hex'),
        seed: Buffer.from(credentialJSON.seed, 'hex'),
      });
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }

  /**
   *  change the wallet backup status if necessary
   * @param walletId
   * @returns {Promise<DBWallet>}
   * @throws {OneKeyInternalError}
   */
  confirmHDWalletBackuped(walletId: string): Promise<DBWallet> {
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
      return Promise.resolve(wallet as unknown as DBWallet);
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
      if (wallet.accounts!.filtered('id = $0', accountId).length === 0) {
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
          'mainContext',
        );
        if (typeof context === 'undefined') {
          return Promise.reject(new OneKeyInternalError('Context not found.'));
        }
        if (!checkPassword(context, password)) {
          return Promise.reject(new WrongPassword());
        }
      }
      this.realm!.write(() => {
        wallet.accounts!.delete(account);
        this.realm!.delete(account);
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
      return Promise.resolve(account as unknown as DBAccount);
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
    _networkId: string,
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
      if (account.type === ACCOUNT_TYPE_SIMPLE) {
        this.realm!.write(() => {
          account.address = address;
        });
      } else {
        /* this.realm!.write(() => {
          account.addresses!.add(address);
        }); */
        throw new NotImplemented();
      }
      return Promise.resolve(account as unknown as DBAccount);
    } catch (error: any) {
      console.error(error);
      return Promise.reject(new OneKeyInternalError(error));
    }
  }
}
export { RealmDB };
