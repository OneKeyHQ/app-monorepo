/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */

import { NotImplemented } from './errors';
import { Account, ImportableHDAccount } from './types/account';
import { Token } from './types/token';
import { Wallet } from './types/wallet';

class Engine {
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

  addTokenToAccount(
    accountId: string,
    networkId: string,
    tokenId: string,
    logoURI?: string,
  ): Promise<Token> {
    // Add an token to account.
    console.log(
      `addTokenToAccount ${accountId} ${networkId} ${tokenId} ${logoURI || ''}`,
    );
    throw new NotImplemented();
  }

  removeTokenFromAccount(
    accountId: string,
    networkId: string,
    tokenIdOnNetwork: string,
  ): Promise<void> {
    // Remove token from an account.
    console.log(
      `removeTokenFromAccount ${accountId} ${networkId} ${tokenIdOnNetwork}`,
    );
    throw new NotImplemented();
  }

  getTokens(networkId: string, accountId?: string): Promise<Array<Token>> {
    // Get token info by network and account.
    console.log(`getTokens ${networkId} ${accountId || ''}`);
    throw new NotImplemented();
  }

  // TODO: transfer, sign & broadcast.
  // transfer
  // signTransaction
  // signMessage
  // broadcastRawTransaction

  // TODO: networks
  // listNetworks(impl?: string): Promise<Array<Network>>;
  // addNetwork()
  // updateNetworkList()
  // updateNetwork()
  getRPCEndpoints(networkId: string): Promise<Array<string>> {
    // List preset/saved rpc endpoints of a network.
    console.log(`getRPCEndpoints ${networkId}`);
    throw new NotImplemented();
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
