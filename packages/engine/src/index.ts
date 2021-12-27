/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import { IMPL_EVM } from './constants';
import { DbApi } from './db';
import { DBAPI } from './db/base';
import { NotImplemented, OneKeyInternalError } from './errors';
import { fromDBNetworkToNetwork, getEVMNetworkToCreate } from './networks';
import {
  getPresetTokensOnNetwork,
  networkIsPreset,
  presetNetworks,
} from './presets';
import { Account, ImportableHDAccount } from './types/account';
import {
  AddNetworkParams,
  DBNetwork,
  Network,
  NetworkShort,
  UpdateNetworkParams,
} from './types/network';
import { Token } from './types/token';
import { Wallet } from './types/wallet';

class Engine {
  private dbApi: DBAPI;

  constructor() {
    this.dbApi = new DbApi() as DBAPI;
  }

  getWallets(): Promise<Array<Wallet>> {
    // Return all wallets, including the special imported wallet and watching wallet.
    throw new NotImplemented();
  }

  getWallet(walletId: string): Promise<Wallet> {
    // Return a single wallet.
    console.log(`getWallet ${walletId}`);
    throw new NotImplemented();
  }

  createHDWallet(
    password: string,
    seed?: string,
    name?: string,
  ): Promise<Wallet> {
    // Create an HD wallet, generate seed if not provided.
    const walletSeed =
      seed ||
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const walletName = name || 'place holder';
    console.log(`createHDWallet ${password} ${walletSeed} ${walletName}`);
    throw new NotImplemented();
  }

  removeWallet(walletId: string, password: string): Promise<void> {
    // Remove a wallet, raise an error if trying to remove the imported or watching wallet.
    console.log(`removeWallet ${walletId} ${password}`);
    throw new NotImplemented();
  }

  setWalletName(walletId: string, name: string): Promise<Wallet> {
    // Rename a wallet, raise an error if trying to rename the imported or watching wallet.
    console.log(`setWalletName ${walletId} ${name}`);
    throw new NotImplemented();
  }

  revealHDWalletSeed(walletId: string, password: string): Promise<string> {
    // Reveal the wallet seed, raise an error if wallet isn't HD, doesn't exist or password is wrong.
    console.log(`revealHDWalletSeed ${walletId} ${password}`);
    throw new NotImplemented();
  }

  confirmHDWalletBackuped(walletId: string): Promise<Wallet> {
    // Confirm that the wallet seed is backed up. Raise an error if wallet isn't HD, doesn't exist. Nothing happens if the wallet is already backed up before this call.
    console.log(`confirmHDWalletBackuped ${walletId}`);
    throw new NotImplemented();
  }

  getAccounts(accountIds: Array<string>): Promise<Array<Account>> {
    // List accounts by account ids. No token info are returned, only base account info are included.
    console.log(`getAccounts ${JSON.stringify(accountIds)}`);
    throw new NotImplemented();
  }

  getAccount(accountId: string): Promise<Account> {
    // Get account by id. Raise an error if account doesn't exist.
    // Token ids are included.
    console.log(`getAccount ${accountId}`);
    throw new NotImplemented();
  }

  getAccountBalance(
    accountId: string,
    tokenIds: Array<string>,
  ): Map<string, number> {
    // Get account balance, main token balance is always included.
    console.log(`getAccountBalance ${accountId} ${JSON.stringify(tokenIds)}`);
    throw new NotImplemented();
  }

  searchHDAccounts(
    walletId: string,
    networkId: string,
    start = 0,
    limit = 10,
  ): Promise<Array<ImportableHDAccount>> {
    // Search importable HD accounts.
    console.log(`searchHDAccounts ${walletId} ${networkId} ${start} ${limit}`);
    throw new NotImplemented();
  }

  addHDAccount(
    walletId: string,
    password: string,
    path?: string,
    name?: string,
  ): Promise<Account> {
    // And an HD account to wallet. Path and name are auto detected if not specified.
    // Raise an error if:
    // 1. wallet,
    //   a. doesn't exist,
    //   b. is not an HD account;
    // 2. password is wrong;
    // 3. account already exists;
    // 4. path is illegal, as the corresponding implementation is dected from the path.
    console.log(
      `addHDAccount ${walletId} ${password} ${path || 'no path'} ${
        name || 'unknown'
      }`,
    );
    throw new NotImplemented();
  }

  addImportedAccount(
    password: string,
    impl: string,
    credential: string,
  ): Promise<Account> {
    // Add an imported account. Raise an error if account already exists, credential is illegal or password is wrong.
    console.log(`addImportedAccount ${password} ${impl} ${credential}`);
    throw new NotImplemented();
  }

  addWatchingAccount(impl: string, target: string): Promise<Account> {
    // Add an watching account. Raise an error if account already exists.
    console.log(`addWatchingAccount ${impl} ${target}`);
    throw new NotImplemented();
  }

  removeAccount(accountId: string, password: string): Promise<void> {
    // Remove an account. Raise an error if account doesn't exist or password is wrong.
    console.log(`removeAccount ${accountId} ${password}`);
    throw new NotImplemented();
  }

  setAccountName(accountId: string, name: string): Promise<Account> {
    // Rename an account. Raise an error if account doesn't exist.
    // Nothing happens if name is not changed.
    console.log(`setAccountName ${accountId} ${name}`);
    throw new NotImplemented();
  }

  private getOrAddToken(
    networkId: string,
    tokenIdOnNetwork: string,
  ): Promise<Token | null> {
    const tokenId = `${networkId}--${tokenIdOnNetwork}`;
    return this.dbApi.getToken(tokenId).then((token: Token | null) => {
      if (token === null) {
        // TODO: get token info online, read other info from preset add it to db.
        return this.dbApi.addToken({
          id: tokenId,
          name: 'TESTING',
          networkId,
          tokenIdOnNetwork,
          symbol: 'TTT',
          decimals: 18,
          logoURI: '',
        });
      }
      return token;
    });
  }

  addTokenToAccount(accountId: string, tokenId: string): Promise<Token> {
    // Add an token to account.
    return this.dbApi.addTokenToAccount(accountId, tokenId);
  }

  removeTokenFromAccount(accountId: string, tokenId: string): Promise<void> {
    // Remove token from an account.
    return this.dbApi.removeTokenFromAccount(accountId, tokenId);
  }

  preAddToken(
    accountId: string,
    networkId: string,
    tokenIdOnNetwork: string,
  ): Promise<[number, Token] | null> {
    // 1. find local token
    // 2. if not, find token online
    // 3. get token balance
    // 4. return
    // TODO: checkout account and network is compatible.
    // TODO: logoURI?
    return this.getOrAddToken(networkId, tokenIdOnNetwork).then(
      (token: Token | null) => {
        if (token === null) {
          return null;
        }
        return [0, token];
        // TODO: get balance
      },
    );
  }

  getTokens(networkId: string, accountId?: string): Promise<Array<Token>> {
    // Get token info by network and account.
    return this.dbApi
      .getTokens(networkId, accountId)
      .then((tokens: Array<Token>) => {
        if (typeof accountId !== 'undefined') {
          return tokens;
        }
        const existingTokens = new Set(
          tokens.map((token: Token) => token.tokenIdOnNetwork),
        );

        return tokens.concat(
          getPresetTokensOnNetwork(networkId).filter(
            (token: Token) => !existingTokens.has(token.tokenIdOnNetwork),
          ),
        );
      });
  }

  // TODO: transfer, sign & broadcast.
  // transfer
  // signTransaction
  // signMessage
  // broadcastRawTransaction

  listNetworks(enabledOnly = true): Promise<Map<string, Array<NetworkShort>>> {
    return this.dbApi.listNetworks().then((networks: Array<DBNetwork>) => {
      const ret: Map<string, Array<NetworkShort>> = new Map(
        [[IMPL_EVM, []]], // TODO: other implemetations
      );
      networks.forEach((network) => {
        if (enabledOnly && !network.enabled) {
          return;
        }
        if (ret.has(network.impl)) {
          const tmpL = ret.get(network.impl) || [];
          tmpL.push({
            id: network.id,
            name: network.name,
            impl: network.impl,
            symbol: network.symbol,
            logoURI: network.logoURI,
            enabled: network.enabled,
            preset: networkIsPreset(network.id),
          });
        } else {
          throw new OneKeyInternalError(
            `listNetworks: unknown network implementation ${network.impl}.`,
          );
        }
      });
      return ret;
    });
  }

  addNetwork(impl: string, params: AddNetworkParams): Promise<Network> {
    if (impl !== IMPL_EVM) {
      throw new OneKeyInternalError(
        `addNetwork: unsupported implementation ${impl} specified`,
      );
    }
    if (params.rpcURL === '') {
      throw new OneKeyInternalError(
        'addNetwork: empty value is not allowed for RPC URL.',
      );
    }
    return this.dbApi
      .addNetwork(getEVMNetworkToCreate(params))
      .then((dbObj: DBNetwork) => fromDBNetworkToNetwork(dbObj));
  }

  getNetwork(networkId: string): Promise<Network> {
    return this.dbApi
      .getNetwork(networkId)
      .then((dbObj: DBNetwork) => fromDBNetworkToNetwork(dbObj));
  }

  updateNetworkList(
    networks: Array<[string, boolean]>,
  ): Promise<Map<string, Array<NetworkShort>>> {
    return this.dbApi
      .updateNetworkList(networks)
      .then(() => this.listNetworks(false));
  }

  updateNetwork(
    networkId: string,
    params: UpdateNetworkParams,
  ): Promise<Network> {
    if (Object.keys(params).length === 0) {
      throw new OneKeyInternalError('updateNetwork: params is empty.');
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
    return this.dbApi
      .updateNetwork(networkId, params)
      .then((dbObj: DBNetwork) => fromDBNetworkToNetwork(dbObj));
  }

  deleteNetwork(networkId: string): Promise<void> {
    if (networkIsPreset(networkId)) {
      throw new OneKeyInternalError('Preset network cannot be deleted.');
    }
    return this.dbApi.deleteNetwork(networkId);
  }

  getRPCEndpoints(networkId: string): Promise<Array<string>> {
    // List preset/saved rpc endpoints of a network.
    return this.dbApi.getNetwork(networkId).then((network: DBNetwork) => {
      const { presetRpcURLs } = presetNetworks.get(networkId) || {
        presetRpcURLs: [],
      };
      return [network.rpcURL].concat(
        presetRpcURLs.filter((url) => url !== network.rpcURL),
      );
    });
  }

  // TODO: RPC interactions.
  // getGasPrice(networkId: string);
  // estimateGasLimit();
  // getRPCEndpointStatus(networkId: string, rpcURL?: string);

  getPrices(networkId: string, tokens?: Array<string>): Map<string, number> {
    // Get price info. Main token price (in fiat) is always included.
    console.log(`getPrices ${networkId} ${JSON.stringify(tokens || [])}`);
    throw new NotImplemented();
  }

  listFiats(): Promise<Array<string>> {
    return new Promise((resolve, _reject) => {
      resolve(['usd', 'cny', 'jpn', 'hkd']);
    });
  }

  setFiat(symbol: string): Promise<void> {
    // Set fiat symbol that is used throughout the app.
    console.log(`setFiat ${symbol}`);
    throw new NotImplemented();
  }

  updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    // Update global password.
    console.log(`updatePassword ${oldPassword} ${newPassword}`);
    throw new NotImplemented();
  }

  resetApp(password: string): Promise<void> {
    // Reset app.
    console.log(`resetApp ${password}`);
    throw new NotImplemented();
  }
}

export { Engine };
