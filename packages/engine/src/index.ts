/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import BigNumber from 'bignumber.js';
import * as bip39 from 'bip39';

import { BaseClient } from '@onekeyhq/blockchain-libs/dist/provider/abc';
import {
  mnemonicFromEntropy,
  revealableSeedFromMnemonic,
} from '@onekeyhq/blockchain-libs/dist/secret';

import { IMPL_EVM } from './constants';
import { DbApi } from './db';
import { DBAPI } from './db/base';
import { NotImplemented, OneKeyInternalError } from './errors';
import {
  fromDBAccountToAccount,
  getAccountBalance,
  getDBAccountBalance,
  getWatchingAccountToCreate,
  isAccountCompatibleWithNetwork,
} from './managers/account';
import {
  fromDBNetworkToNetwork,
  getEVMNetworkToCreate,
} from './managers/network';
import { getNetworkIdFromTokenId } from './managers/token';
import {
  fromDBWalletToWallet,
  walletCanBeRemoved,
  walletIsHD,
  walletNameCanBeUpdated,
} from './managers/wallet';
import {
  getPresetToken,
  getPresetTokensOnNetwork,
  networkIsPreset,
  presetNetworks,
} from './presets';
import { initClientFromDBNetwork } from './proxy';
import { Account, DBAccount, ImportableHDAccount } from './types/account';
import {
  AddNetworkParams,
  DBNetwork,
  Network,
  NetworkShort,
  UpdateNetworkParams,
} from './types/network';
import { Token } from './types/token';
import { DBWallet, Wallet } from './types/wallet';

class Engine {
  private dbApi: DBAPI;

  private clients: Record<string, BaseClient>;

  constructor() {
    this.dbApi = new DbApi() as DBAPI;
    this.clients = {};
  }

  private getClient(networkId: string): Promise<BaseClient> {
    if (typeof this.clients[networkId] === 'undefined') {
      return this.dbApi.getNetwork(networkId).then((dbNetwork: DBNetwork) => {
        this.clients[networkId] = initClientFromDBNetwork(dbNetwork);
        return this.clients[networkId];
      });
    }
    return new Promise((resolve, _reject) => {
      resolve(this.clients[networkId]);
    });
  }

  getWallets(): Promise<Array<Wallet>> {
    // Return all wallets, including the special imported wallet and watching wallet.
    return this.dbApi
      .getWallets()
      .then((wallets: Array<DBWallet>) =>
        wallets.map((w: DBWallet) => fromDBWalletToWallet(w)),
      );
  }

  getWallet(walletId: string): Promise<Wallet> {
    // Return a single wallet.
    return this.dbApi
      .getWallet(walletId)
      .then((dbWallet: DBWallet | undefined) => {
        if (typeof dbWallet !== 'undefined') {
          return fromDBWalletToWallet(dbWallet);
        }
        throw new OneKeyInternalError(`Wallet ${walletId} not found.`);
      });
  }

  createHDWallet(
    password: string,
    mnemonic?: string,
    name?: string,
  ): Promise<Wallet> {
    // Create an HD wallet, generate seed if not provided.
    const usedMnemonic = mnemonic || bip39.generateMnemonic();
    let rs;
    try {
      rs = revealableSeedFromMnemonic(usedMnemonic, password);
    } catch {
      throw new OneKeyInternalError('Invalid mnemonic.');
    }
    if (
      !bip39.validateMnemonic(usedMnemonic) ||
      usedMnemonic !== mnemonicFromEntropy(rs.entropyWithLangPrefixed, password)
    ) {
      throw new OneKeyInternalError('Invalid mnemonic.');
    }
    return this.dbApi
      .createHDWallet(password, rs, name)
      .then((dbWallet: DBWallet) => fromDBWalletToWallet(dbWallet));
  }

  removeWallet(walletId: string, password: string): Promise<void> {
    // Remove a wallet, raise an error if trying to remove the imported or watching wallet.
    if (!walletCanBeRemoved(walletId)) {
      throw new OneKeyInternalError(`Wallet ${walletId} cannot be removed.`);
    }
    return this.dbApi.removeWallet(walletId, password);
  }

  setWalletName(walletId: string, name: string): Promise<Wallet> {
    // Rename a wallet, raise an error if trying to rename the imported or watching wallet.
    if (!walletNameCanBeUpdated(walletId)) {
      throw new OneKeyInternalError(
        `Wallet ${walletId}'s name cannot be updated.`,
      );
    }
    return this.dbApi
      .setWalletName(walletId, name)
      .then((dbWallet: DBWallet) => fromDBWalletToWallet(dbWallet));
  }

  revealHDWalletSeed(walletId: string, password: string): Promise<string> {
    // Reveal the wallet seed, raise an error if wallet isn't HD, doesn't exist or password is wrong.
    if (!walletIsHD(walletId)) {
      throw new OneKeyInternalError(`Wallet ${walletId} is not an HD wallet.`);
    }
    return this.dbApi.revealHDWalletSeed(walletId, password);
  }

  confirmHDWalletBackuped(walletId: string): Promise<Wallet> {
    // Confirm that the wallet seed is backed up. Raise an error if wallet isn't HD, doesn't exist. Nothing happens if the wallet is already backed up before this call.
    if (!walletIsHD(walletId)) {
      throw new OneKeyInternalError(`Wallet ${walletId} is not an HD wallet.`);
    }
    return this.dbApi
      .confirmHDWalletBackuped(walletId)
      .then((dbWallet: DBWallet) => fromDBWalletToWallet(dbWallet));
  }

  getAccounts(accountIds: Array<string>): Promise<Array<Account>> {
    // List accounts by account ids. No token info are returned, only base account info are included.
    return this.dbApi
      .getAccounts(accountIds)
      .then((accounts: Array<DBAccount>) =>
        accounts.map((a: DBAccount) => fromDBAccountToAccount(a)),
      );
  }

  getAccount(accountId: string, networkId: string): Promise<Account> {
    // Get account by id. Raise an error if account doesn't exist.
    // Token ids are included.
    return this.dbApi
      .getAccount(accountId)
      .then((dbAccount: DBAccount | undefined) => {
        if (typeof dbAccount !== 'undefined') {
          const account: Account = fromDBAccountToAccount(dbAccount);
          return this.dbApi
            .getTokens(networkId, accountId)
            .then((tokens: Array<Token>) => {
              account.tokens = tokens;
              return account;
            });
        }
        throw new OneKeyInternalError(`Account ${accountId} not found.`);
      });
  }

  getAccountBalance(
    accountId: string,
    networkId: string,
    tokenIdsOnNetwork: Array<string>,
    withMain = true,
  ): Promise<Record<string, BigNumber | undefined>> {
    // Get account balance, main token balance is always included.
    return Promise.all([
      this.dbApi.getAccount(accountId),
      this.getNetwork(networkId),
      this.getClient(networkId),
      this.getTokens(networkId, accountId),
    ]).then(([dbAccount, network, client, tokens]) => {
      const decimalsMap: Record<string, number> = {};
      tokens.forEach((token) => {
        if (tokenIdsOnNetwork.includes(token.tokenIdOnNetwork)) {
          decimalsMap[token.tokenIdOnNetwork] = token.decimals;
        }
      });
      const tokensToGet = tokenIdsOnNetwork.filter(
        (tokenId) => typeof decimalsMap[tokenId] !== 'undefined',
      );
      return getDBAccountBalance(client, dbAccount, tokensToGet, withMain).then(
        (balances) => {
          const ret: Record<string, BigNumber | undefined> = {};
          if (withMain && typeof balances[0] !== 'undefined') {
            ret.main = balances[0].div(new BigNumber(10).pow(network.decimals));
          }
          balances.slice(withMain ? 1 : 0).forEach((balance, index) => {
            const tokenId = tokensToGet[index];
            const decimals = decimalsMap[tokenId];
            if (typeof balance !== 'undefined') {
              ret[tokenId] = balance.div(new BigNumber(10).pow(decimals));
            }
          });
          return ret;
        },
      );
    });
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

  addWatchingAccount(
    impl: string,
    target: string,
    name?: string,
  ): Promise<Account> {
    // Add an watching account. Raise an error if account already exists.
    // TODO: now only adding by address is supported.
    return this.dbApi
      .listNetworks()
      .then((networks) => networks.filter((n) => n.impl === impl)[0])
      .then((network) => {
        if (typeof network === 'undefined') {
          throw new OneKeyInternalError(
            `Unable to add watching account: wrong implementation ${impl}`,
          );
        }
        return this.getClient(network.id);
      })
      .then((client) => getAccountBalance(client, target, []))
      .then((balance) => {
        if (typeof balance === 'undefined') {
          throw new OneKeyInternalError('Invalid address.'); // TODO: better error report.
        }
        return this.dbApi
          .addAccountToWallet(
            'watching',
            getWatchingAccountToCreate(impl, target, name),
          )
          .then((a: DBAccount) => fromDBAccountToAccount(a));
      });
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
  ): Promise<Token | undefined> {
    const tokenId = `${networkId}--${tokenIdOnNetwork}`;
    return this.dbApi.getToken(tokenId).then((token) => {
      if (typeof token === 'undefined') {
        const toAdd = getPresetToken(networkId, tokenIdOnNetwork);
        return this.getClient(networkId)
          .then((client) => client.getTokenInfos([tokenIdOnNetwork]))
          .then(([info]) => {
            toAdd.id = tokenId;
            Object.assign(toAdd, info);
            if (toAdd.decimals === -1) {
              throw new NotImplemented();
            }
            return this.dbApi.addToken(toAdd);
          });
      }
      return token;
    });
  }

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

  removeTokenFromAccount(accountId: string, tokenId: string): Promise<void> {
    // Remove token from an account.
    return this.dbApi.removeTokenFromAccount(accountId, tokenId);
  }

  preAddToken(
    accountId: string,
    networkId: string,
    tokenIdOnNetwork: string,
  ): Promise<[BigNumber | undefined, Token] | undefined> {
    // 1. find local token
    // 2. if not, find token online
    // 3. get token balance
    // 4. return
    // TODO: logoURI?
    if (!isAccountCompatibleWithNetwork(accountId, networkId)) {
      throw new OneKeyInternalError(
        `account ${accountId} and network ${networkId} isn't compatible.`,
      );
    }
    return this.getOrAddToken(networkId, tokenIdOnNetwork).then((token) => {
      if (typeof token === 'undefined') {
        return undefined;
      }
      return Promise.all([
        this.dbApi.getAccount(accountId),
        this.getClient(networkId),
      ]).then(([dbAccount, client]) =>
        getDBAccountBalance(client, dbAccount, [tokenIdOnNetwork], false).then(
          ([balance]) => {
            if (typeof balance === 'undefined') {
              return undefined;
            }
            return [balance.div(new BigNumber(10).pow(token.decimals)), token];
          },
        ),
      );
    });
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
      const { presetRpcURLs } = presetNetworks[networkId] || {
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

  getPrices(networkId: string, tokens?: Array<string>): Map<string, BigNumber> {
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
