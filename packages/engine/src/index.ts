/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import BigNumber from 'bignumber.js';
import * as bip39 from 'bip39';

import {
  mnemonicFromEntropy,
  revealableSeedFromMnemonic,
} from '@onekeyhq/blockchain-libs/dist/secret';

import { IMPL_EVM, IMPL_SOL, SEPERATOR } from './constants';
import { DbApi } from './dbs';
import { DBAPI } from './dbs/base';
import {
  FailedToTransfer,
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from './errors';
import {
  buildGetBalanceRequest,
  buildGetBalanceRequestsRaw,
  fromDBAccountToAccount,
  getHDAccountToAdd,
  getWalletIdFromAccountId,
  getWatchingAccountToCreate,
  isAccountCompatibleWithNetwork,
} from './managers/account';
import { getTxHistories } from './managers/covalent';
import { getDefaultPurpose, getXpubs } from './managers/derivation';
import { implToCoinTypes } from './managers/impl';
import {
  fromDBNetworkToNetwork,
  getEVMNetworkToCreate,
  getImplFromNetworkId,
} from './managers/network';
import { getNetworkIdFromTokenId } from './managers/token';
import {
  walletCanBeRemoved,
  walletIsHD,
  walletNameCanBeUpdated,
} from './managers/wallet';
import {
  getPresetNetworks,
  getPresetToken,
  getPresetTokensOnNetwork,
  networkIsPreset,
} from './presets';
import { ProviderController, fromDBNetworkToChainInfo } from './proxy';
import {
  ACCOUNT_TYPE_SIMPLE,
  Account,
  DBAccount,
  DBSimpleAccount,
  ImportableHDAccount,
} from './types/account';
import {
  HistoryEntry,
  HistoryEntryStatus,
  HistoryEntryType,
} from './types/history';
import {
  AddNetworkParams,
  EIP1559Fee,
  Network,
  NetworkShort,
  UpdateNetworkParams,
} from './types/network';
import { Token } from './types/token';
import { WALLET_TYPE_HD, Wallet } from './types/wallet';

class Engine {
  private dbApi: DBAPI;

  private providerManager: ProviderController;

  constructor() {
    this.dbApi = new DbApi() as DBAPI;
    this.providerManager = new ProviderController((networkId) =>
      this.dbApi
        .getNetwork(networkId)
        .then((dbNetwork) => fromDBNetworkToChainInfo(dbNetwork)),
    );
  }

  getWallets(): Promise<Array<Wallet>> {
    // Return all wallets, including the special imported wallet and watching wallet.
    return this.dbApi.getWallets();
  }

  async getWallet(walletId: string): Promise<Wallet> {
    // Return a single wallet.
    const wallet = await this.dbApi.getWallet(walletId);
    if (typeof wallet !== 'undefined') {
      return wallet;
    }
    throw new OneKeyInternalError(`Wallet ${walletId} not found.`);
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
    return this.dbApi.createHDWallet(password, rs, name);
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
    return this.dbApi.setWalletName(walletId, name);
  }

  async revealHDWalletMnemonic(
    walletId: string,
    password: string,
  ): Promise<string> {
    // Reveal the wallet seed, raise an error if wallet isn't HD, doesn't exist or password is wrong.
    if (!walletIsHD(walletId)) {
      throw new OneKeyInternalError(`Wallet ${walletId} is not an HD wallet.`);
    }
    const credential = await this.dbApi.getCredential(walletId, password);
    return mnemonicFromEntropy(credential.entropy, password);
  }

  confirmHDWalletBackuped(walletId: string): Promise<Wallet> {
    // Confirm that the wallet seed is backed up. Raise an error if wallet isn't HD, doesn't exist. Nothing happens if the wallet is already backed up before this call.
    if (!walletIsHD(walletId)) {
      throw new OneKeyInternalError(`Wallet ${walletId} is not an HD wallet.`);
    }
    return this.dbApi.confirmHDWalletBackuped(walletId);
  }

  async getAccounts(accountIds: Array<string>): Promise<Array<Account>> {
    // List accounts by account ids. No token info are returned, only base account info are included.
    const accounts = await this.dbApi.getAccounts(accountIds);
    return accounts.map((a: DBAccount) => fromDBAccountToAccount(a));
  }

  async getAccountsByNetwork(
    networkId: string,
  ): Promise<Record<string, Array<Account>>> {
    const ret: Record<string, Array<Account>> = {};
    const accounts = await this.dbApi.getAllAccounts();
    accounts
      .filter((a) => isAccountCompatibleWithNetwork(a.id, networkId))
      .forEach((a) => {
        const [walletId] = a.id.split(SEPERATOR, 1);
        if (typeof ret[walletId] === 'undefined') {
          ret[walletId] = [];
        }
        ret[walletId].push(fromDBAccountToAccount(a));
      });
    return ret;
  }

  async getAccount(accountId: string, networkId: string): Promise<Account> {
    // Get account by id. Raise an error if account doesn't exist.
    // Token ids are included.
    let dbAccount = await this.dbApi.getAccount(accountId);
    if (typeof dbAccount === 'undefined') {
      throw new OneKeyInternalError(`Account ${accountId} not found.`);
    }

    if (
      dbAccount.type === ACCOUNT_TYPE_SIMPLE &&
      (dbAccount as DBSimpleAccount).address === ''
    ) {
      const address = await this.providerManager.addressFromPub(
        networkId,
        (dbAccount as DBSimpleAccount).pub,
      );
      dbAccount = await this.dbApi.addAccountAddress(
        accountId,
        networkId,
        address,
      );
    }

    const account = fromDBAccountToAccount(dbAccount);
    account.tokens = await this.dbApi.getTokens(networkId, accountId);
    return account;
  }

  async getAccountBalance(
    accountId: string,
    networkId: string,
    tokenIdsOnNetwork: Array<string>,
    withMain = true,
  ): Promise<Record<string, BigNumber | undefined>> {
    // Get account balance, main token balance is always included.
    const [dbAccount, network, tokens] = await Promise.all([
      this.dbApi.getAccount(accountId),
      this.getNetwork(networkId),
      this.getTokens(networkId, accountId, false),
    ]);
    const decimalsMap: Record<string, number> = {};
    tokens.forEach((token) => {
      if (tokenIdsOnNetwork.includes(token.tokenIdOnNetwork)) {
        decimalsMap[token.tokenIdOnNetwork] = token.decimals;
      }
    });
    const tokensToGet = tokenIdsOnNetwork.filter(
      (tokenId) => typeof decimalsMap[tokenId] !== 'undefined',
    );
    const balances = await this.providerManager.getBalances(
      networkId,
      buildGetBalanceRequest(dbAccount, tokensToGet, withMain),
    );
    const ret: Record<string, BigNumber | undefined> = {};
    if (withMain && typeof balances[0] !== 'undefined') {
      ret.main = balances[0].div(new BigNumber(10).pow(network.decimals));
    }
    balances.slice(withMain ? 1 : 0).forEach((balance, index) => {
      const tokenId1 = tokensToGet[index];
      const decimals = decimalsMap[tokenId1];
      if (typeof balance !== 'undefined') {
        ret[tokenId1] = balance.div(new BigNumber(10).pow(decimals));
      }
    });
    return ret;
  }

  async searchHDAccounts(
    walletId: string,
    networkId: string,
    password: string,
    start = 0,
    limit = 10,
    purpose?: number,
  ): Promise<Array<ImportableHDAccount>> {
    // Search importable HD accounts.
    const [credential, dbNetwork] = await Promise.all([
      this.dbApi.getCredential(walletId, password),
      this.dbApi.getNetwork(networkId),
    ]);
    const { paths, xpubs } = getXpubs(
      getImplFromNetworkId(networkId),
      credential.seed,
      password,
      start,
      limit,
      purpose,
      dbNetwork.curve,
    );
    const requests = await Promise.all(
      xpubs.map(async (xpub) =>
        buildGetBalanceRequestsRaw(
          await this.providerManager.addressFromXpub(networkId, xpub),
          [],
        ),
      ),
    );
    const balances = await this.providerManager.getBalances(
      networkId,
      requests.reduce((a, b) => a.concat(b), []),
    );
    return balances.map((balance, index) => ({
      index: start + index,
      path: paths[index],
      mainBalance:
        typeof balance === 'undefined'
          ? new BigNumber(0)
          : balance.div(new BigNumber(10).pow(dbNetwork.decimals)),
    }));
  }

  async addHDAccount(
    password: string,
    walletId: string,
    networkId: string,
    index?: number,
    name?: string,
    purpose?: number,
  ): Promise<Account> {
    // And an HD account to wallet. Path and name are auto detected if not specified.
    // Raise an error if:
    // 1. wallet,
    //   a. doesn't exist,
    //   b. is not an HD account;
    // 2. password is wrong;
    // 3. account already exists;
    const wallet = await this.dbApi.getWallet(walletId);
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

    const impl = getImplFromNetworkId(networkId);
    const usedPurpose = purpose || getDefaultPurpose(impl);
    const usedIndex =
      index ||
      wallet.nextAccountIds[`${usedPurpose}'/${implToCoinTypes[impl]}'`] ||
      0;
    const [credential, dbNetwork] = await Promise.all([
      this.dbApi.getCredential(walletId, password),
      this.dbApi.getNetwork(networkId),
    ]);
    const { paths, xpubs } = getXpubs(
      getImplFromNetworkId(networkId),
      credential.seed,
      password,
      usedIndex,
      1,
      usedPurpose,
      dbNetwork.curve,
    );
    return this.dbApi
      .addAccountToWallet(
        walletId,
        getHDAccountToAdd(impl, walletId, paths[0], xpubs[0], name),
      )
      .then((a: DBAccount) => this.getAccount(a.id, networkId));
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

  async addWatchingAccount(
    networkId: string,
    target: string,
    name?: string,
  ): Promise<Account> {
    // Add an watching account. Raise an error if account already exists.
    // TODO: now only adding by address is supported.
    const { normalizedAddress, isValid } =
      await this.providerManager.verifyAddress(networkId, target);
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }
    const account = getWatchingAccountToCreate(
      getImplFromNetworkId(networkId),
      normalizedAddress,
      name,
    );
    const a = await this.dbApi.addAccountToWallet('watching', account);
    return this.getAccount(a.id, networkId);
  }

  removeAccount(accountId: string, password: string): Promise<void> {
    // Remove an account. Raise an error if account doesn't exist or password is wrong.
    return this.dbApi.removeAccount(
      getWalletIdFromAccountId(accountId),
      accountId,
      password,
    );
  }

  async setAccountName(accountId: string, name: string): Promise<Account> {
    // Rename an account. Raise an error if account doesn't exist.
    // Nothing happens if name is not changed.
    const a = await this.dbApi.setAccountName(accountId, name);
    return fromDBAccountToAccount(a);
  }

  private async getOrAddToken(
    networkId: string,
    tokenIdOnNetwork: string,
  ): Promise<Token | undefined> {
    const tokenId = `${networkId}--${tokenIdOnNetwork}`;
    const token = await this.dbApi.getToken(tokenId);
    if (typeof token === 'undefined') {
      const toAdd = getPresetToken(networkId, tokenIdOnNetwork);
      return this.providerManager
        .getTokenInfos(networkId, [tokenIdOnNetwork])
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

  async preAddToken(
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
    const token = await this.getOrAddToken(networkId, tokenIdOnNetwork);
    if (typeof token === 'undefined') {
      return undefined;
    }
    const dbAccount = await this.dbApi.getAccount(accountId);
    const [balance] = await this.providerManager.getBalances(
      networkId,
      buildGetBalanceRequest(dbAccount, [tokenIdOnNetwork], false),
    );
    if (typeof balance === 'undefined') {
      return undefined;
    }
    return [balance.div(new BigNumber(10).pow(token.decimals)), token];
  }

  async getTokens(
    networkId: string,
    accountId?: string,
    withMain = true,
  ): Promise<Array<Token>> {
    // Get token info by network and account.
    const tokens = await this.dbApi.getTokens(networkId, accountId);
    if (typeof accountId !== 'undefined') {
      // TODO: add default tokens.
      if (withMain) {
        const dbNetwork = await this.dbApi.getNetwork(networkId);
        tokens.unshift({
          id: dbNetwork.id,
          name: dbNetwork.name,
          networkId,
          tokenIdOnNetwork: '',
          symbol: dbNetwork.symbol,
          decimals: dbNetwork.decimals,
          logoURI: dbNetwork.logoURI,
        });
      }
      return tokens;
    }
    const existingTokens = new Set(
      tokens.map((token: Token) => token.tokenIdOnNetwork),
    );
    return tokens.concat(
      getPresetTokensOnNetwork(networkId).filter(
        (token1: Token) => !existingTokens.has(token1.tokenIdOnNetwork),
      ),
    );
  }

  async prepareTransfer(
    networkId: string,
    accountId: string,
    to: string,
    value: BigNumber,
    tokenIdOnNetwork?: string,
    extra?: { [key: string]: any },
  ): Promise<BigNumber> {
    // For account model networks, return the estimated gas usage.
    // TODO: For UTXO model networks, return the transaction size & selected UTXOs.
    // TODO: validate to parameter.
    const [network, account] = await Promise.all([
      this.getNetwork(networkId),
      this.getAccount(accountId, networkId),
    ]);
    // Below properties are used to avoid redundant network requests.
    const payload = extra || {};
    payload.nonce = 1;
    payload.feePricePerUnit = new BigNumber(1);
    return this.providerManager.preSend(
      network,
      account,
      to,
      value,
      tokenIdOnNetwork,
      payload,
    );
  }

  async getGasPrice(networkId: string): Promise<Array<BigNumber | EIP1559Fee>> {
    const ret = await this.providerManager.getGasPrice(networkId);
    if (ret.length > 0 && ret[0] instanceof BigNumber) {
      const { feeDecimals } = await this.dbApi.getNetwork(networkId);
      return (ret as Array<BigNumber>).map((price: BigNumber) =>
        price.shiftedBy(-feeDecimals),
      );
    }
    return ret;
  }

  async transfer(
    password: string,
    networkId: string,
    accountId: string,
    to: string,
    value: BigNumber,
    gasPrice: BigNumber,
    gasLimit: BigNumber,
    tokenIdOnNetwork?: string,
    extra?: { [key: string]: any },
  ): Promise<{ txid: string; success: boolean }> {
    const [credential, network, account] = await Promise.all([
      this.dbApi.getCredential(getWalletIdFromAccountId(accountId), password),
      this.getNetwork(networkId),
      this.getAccount(accountId, networkId),
    ]);
    try {
      const { txid, rawTx, success } =
        await this.providerManager.simpleTransfer(
          credential.seed,
          password,
          network,
          account,
          to,
          value,
          tokenIdOnNetwork,
          {
            ...extra,
            feeLimit: gasLimit,
            feePricePerUnit: gasPrice,
          },
        );
      await this.dbApi.addHistoryEntry(
        `${networkId}--${txid}`,
        networkId,
        accountId,
        HistoryEntryType.TRANSFER,
        HistoryEntryStatus.PENDING,
        {
          contract: tokenIdOnNetwork || '',
          target: to,
          value: value.toFixed(),
          rawTx,
        },
      );
      return { txid, success };
    } catch (e) {
      const { message } = e as { message: string };
      throw new FailedToTransfer(message);
    }
  }

  // TODO: sign & broadcast.
  // signTransaction
  // signMessage
  // broadcastRawTransaction

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
    let updatedStatusMap: Record<string, HistoryEntryStatus> = {};

    if (updatePending) {
      const pendings: Array<string> = [];
      entries.forEach((entry) => {
        if (entry.status === HistoryEntryStatus.PENDING) {
          pendings.push(entry.id);
        }
      });

      updatedStatusMap = await this.providerManager.refreshPendingTxs(
        networkId,
        pendings,
      );
      if (Object.keys(updatedStatusMap).length > 0) {
        await this.dbApi.updateHistoryEntryStatuses(updatedStatusMap);
      }
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

  async listNetworks(
    enabledOnly = true,
  ): Promise<Record<string, Array<NetworkShort>>> {
    const networks = await this.dbApi.listNetworks();
    const ret: Record<string, Array<NetworkShort>> = {
      [IMPL_EVM]: [],
      [IMPL_SOL]: [],
      // TODO: other implemetations
    };
    networks.forEach((network) => {
      if (enabledOnly && !network.enabled) {
        return;
      }
      if (typeof ret[network.impl] !== 'undefined') {
        ret[network.impl].push({
          id: network.id,
          name: network.name,
          impl: network.impl,
          symbol: network.symbol,
          logoURI: network.logoURI,
          enabled: network.enabled,
          preset: networkIsPreset(network.id),
        });
      }
    });
    return ret;
  }

  async addNetwork(impl: string, params: AddNetworkParams): Promise<Network> {
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
    const dbObj = await this.dbApi.addNetwork(getEVMNetworkToCreate(params));
    return fromDBNetworkToNetwork(dbObj);
  }

  async getNetwork(networkId: string): Promise<Network> {
    const dbObj = await this.dbApi.getNetwork(networkId);
    return fromDBNetworkToNetwork(dbObj);
  }

  async updateNetworkList(
    networks: Array<[string, boolean]>,
  ): Promise<Record<string, Array<NetworkShort>>> {
    await this.dbApi.updateNetworkList(networks);
    return this.listNetworks(false);
  }

  async updateNetwork(
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
    const dbObj = await this.dbApi.updateNetwork(networkId, params);
    return fromDBNetworkToNetwork(dbObj);
  }

  deleteNetwork(networkId: string): Promise<void> {
    if (networkIsPreset(networkId)) {
      throw new OneKeyInternalError('Preset network cannot be deleted.');
    }
    return this.dbApi.deleteNetwork(networkId);
  }

  async getRPCEndpoints(networkId: string): Promise<Array<string>> {
    // List preset/saved rpc endpoints of a network.
    const network = await this.dbApi.getNetwork(networkId);
    const presetNetworks = getPresetNetworks();
    const { presetRpcURLs } = presetNetworks[networkId] || {
      presetRpcURLs: [],
    };
    return [network.rpcURL].concat(
      presetRpcURLs.filter((url) => url !== network.rpcURL),
    );
  }

  async getTxHistories(
    networkId: string,
    accountId: string,
    pageNumber: number,
    pageSize: number,
  ) {
    const network = await this.dbApi.getNetwork(networkId);
    const chainId = network.id.split(SEPERATOR)[1];
    return getTxHistories(chainId, accountId, pageNumber, pageSize);
  }

  // TODO: RPC interactions.
  // getRPCEndpointStatus(networkId: string, rpcURL?: string);

  getPrices(
    networkId: string,
    tokenIdsOnNetwork: Array<string>,
    withMain = true,
  ): Promise<Record<string, BigNumber>> {
    // Get price info.
    const ret: Record<string, BigNumber> = {};
    tokenIdsOnNetwork.forEach((tokenId) => {
      ret[tokenId] = new BigNumber(100);
    });
    if (withMain) {
      ret.main = new BigNumber(100);
    }
    return Promise.resolve(ret);
  }

  listFiats(): Promise<Record<string, string>> {
    // TODO: connect price module
    // return Promise.resolve({
    //   'usd': new BigNumber('1'),
    //   'cny': new BigNumber('6.3617384'),
    //   'jpy': new BigNumber('115.36691'),
    //   'hkd': new BigNumber('7.7933804'),
    // });
    return Promise.resolve({
      'usd': '1',
      'cny': '6.3617384',
      'jpy': '115.36691',
      'hkd': '7.7933804',
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
    return this.dbApi.reset(password);
  }
}

export { Engine };
