/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import {
  mnemonicFromEntropy,
  revealableSeedFromMnemonic,
} from '@onekeyfe/blockchain-libs/dist/secret';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';
import * as bip39 from 'bip39';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/kit/src/background/decorators';

import { IMPL_EVM, IMPL_SOL, SEPERATOR, SUPPORTED_IMPLS } from './constants';
import { DbApi } from './dbs';
import { DBAPI, DEFAULT_VERIFY_STRING, checkPassword } from './dbs/base';
import {
  FailedToTransfer,
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from './errors';
import {
  getWalletIdFromAccountId,
  isAccountCompatibleWithNetwork,
} from './managers/account';
import { getErc20TransferHistories, getTxHistories } from './managers/covalent';
import { getDefaultPurpose, getXpubs } from './managers/derivation';
import { implToAccountType, implToCoinTypes } from './managers/impl';
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
import { syncLatestNetworkList } from './presets/network';
import {
  PriceController,
  ProviderController,
  fromDBNetworkToChainInfo,
  getRPCStatus,
} from './proxy';
import {
  Account,
  AccountType,
  DBAccount,
  DBSimpleAccount,
  DBVariantAccount,
  ImportableHDAccount,
} from './types/account';
import {
  HistoryEntry,
  HistoryEntryStatus,
  HistoryEntryType,
} from './types/history';
import { Message } from './types/message';
import {
  AddNetworkParams,
  EIP1559Fee,
  Network,
  UpdateNetworkParams,
} from './types/network';
import { Token } from './types/token';
import { WALLET_TYPE_HD, Wallet } from './types/wallet';

@backgroundClass()
class Engine {
  private dbApi: DBAPI;

  private providerManager: ProviderController;

  private priceManager: PriceController;

  constructor() {
    this.dbApi = new DbApi() as DBAPI;
    this.priceManager = new PriceController();
    this.providerManager = new ProviderController((networkId) =>
      this.dbApi
        .getNetwork(networkId)
        .then((dbNetwork) => fromDBNetworkToChainInfo(dbNetwork)),
    );

    this.syncPresetNetworks();
  }

  async syncPresetNetworks(): Promise<void> {
    await syncLatestNetworkList();

    try {
      const dbNetworks = await this.dbApi.listNetworks();
      const dbNetworkSet = new Set(dbNetworks.map((dbNetwork) => dbNetwork.id));

      const presetNetworksList = Object.values(getPresetNetworks()).sort(
        (a, b) => (a.name > b.name ? 1 : -1),
      );

      let position = dbNetworks.length ?? 0;
      for (const network of presetNetworksList) {
        if (!dbNetworkSet.has(network.id)) {
          await this.dbApi.addNetwork({
            id: network.id,
            name: network.name,
            impl: network.impl,
            symbol: network.symbol,
            logoURI: network.logoURI,
            enabled: network.enabled,
            feeSymbol: network.feeSymbol,
            decimals: network.decimals,
            feeDecimals: network.feeDecimals,
            balance2FeeDecimals: network.balance2FeeDecimals,
            rpcURL: network.presetRpcURLs[0],
            position,
          });
          position += 1;
          dbNetworkSet.add(network.id);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  @backgroundMethod()
  mnemonicToEntropy(mnemonic: string): Promise<string> {
    return Promise.resolve(
      bip39.mnemonicToEntropy(mnemonic, bip39.wordlists.english),
    );
  }

  @backgroundMethod()
  entropyToMnemonic(entropy: string): Promise<string> {
    return Promise.resolve(
      bip39.entropyToMnemonic(entropy, bip39.wordlists.english),
    );
  }

  @backgroundMethod()
  getWallets(): Promise<Array<Wallet>> {
    // Return all wallets, including the special imported wallet and watching wallet.
    return this.dbApi.getWallets();
  }

  @backgroundMethod()
  async getWallet(walletId: string): Promise<Wallet> {
    // Return a single wallet.
    const wallet = await this.dbApi.getWallet(walletId);
    if (typeof wallet !== 'undefined') {
      return wallet;
    }
    throw new OneKeyInternalError(`Wallet ${walletId} not found.`);
  }

  @backgroundMethod()
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
    const backuped = usedMnemonic === mnemonic;
    return this.dbApi.createHDWallet(password, rs, backuped, name);
  }

  @backgroundMethod()
  removeWallet(walletId: string, password: string): Promise<void> {
    // Remove a wallet, raise an error if trying to remove the imported or watching wallet.
    if (!walletCanBeRemoved(walletId)) {
      throw new OneKeyInternalError(`Wallet ${walletId} cannot be removed.`);
    }
    return this.dbApi.removeWallet(walletId, password);
  }

  @backgroundMethod()
  setWalletName(walletId: string, name: string): Promise<Wallet> {
    // Rename a wallet, raise an error if trying to rename the imported or watching wallet.
    if (!walletNameCanBeUpdated(walletId)) {
      throw new OneKeyInternalError(
        `Wallet ${walletId}'s name cannot be updated.`,
      );
    }
    return this.dbApi.setWalletName(walletId, name);
  }

  @backgroundMethod()
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

  @backgroundMethod()
  confirmHDWalletBackuped(walletId: string): Promise<Wallet> {
    // Confirm that the wallet seed is backed up. Raise an error if wallet isn't HD, doesn't exist. Nothing happens if the wallet is already backed up before this call.
    if (!walletIsHD(walletId)) {
      throw new OneKeyInternalError(`Wallet ${walletId} is not an HD wallet.`);
    }
    return this.dbApi.confirmHDWalletBackuped(walletId);
  }

  private async buildReturnedAccount(
    dbAccount: DBAccount,
    networkId?: string,
  ): Promise<Account> {
    const account = {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.address,
    };
    switch (dbAccount.type) {
      case AccountType.SIMPLE:
        if (dbAccount.address === '' && typeof networkId !== 'undefined') {
          const address = await this.providerManager.addressFromPub(
            networkId,
            (dbAccount as DBSimpleAccount).pub,
          );
          await this.dbApi.addAccountAddress(dbAccount.id, networkId, address);
          account.address = address;
        }
        break;
      case AccountType.VARIANT:
        if (typeof networkId !== 'undefined') {
          account.address = ((dbAccount as DBVariantAccount).addresses || {})[
            networkId
          ];
          if (typeof account.address === 'undefined') {
            const address = await this.providerManager.addressFromBase(
              networkId,
              dbAccount.address,
            );
            await this.dbApi.addAccountAddress(
              dbAccount.id,
              networkId,
              address,
            );
            account.address = address;
          }
        }
        break;
      default:
        break;
    }
    return Promise.resolve(account);
  }

  @backgroundMethod()
  async getAccounts(
    accountIds: Array<string>,
    networkId?: string,
  ): Promise<Array<Account>> {
    // List accounts by account ids. No token info are returned, only base account info are included.
    if (accountIds.length === 0) {
      return [];
    }

    const accounts = await this.dbApi.getAccounts(accountIds);
    return Promise.all(
      accounts
        .filter(
          (a) =>
            typeof networkId === 'undefined' ||
            isAccountCompatibleWithNetwork(a.id, networkId),
        )
        .sort((a, b) => (a.name > b.name ? 1 : -1))
        .map((a: DBAccount) => this.buildReturnedAccount(a, networkId)),
    );
  }

  @backgroundMethod()
  async getAccount(accountId: string, networkId: string): Promise<Account> {
    // Get account by id. Raise an error if account doesn't exist.
    // Token ids are included.
    const dbAccount = await this.dbApi.getAccount(accountId);
    const account = await this.buildReturnedAccount(dbAccount, networkId);
    account.tokens = await this.dbApi.getTokens(networkId, accountId);
    return account;
  }

  @backgroundMethod()
  async getAccountBalance(
    accountId: string,
    networkId: string,
    tokenIdsOnNetwork: Array<string>,
    withMain = true,
  ): Promise<Record<string, string | undefined>> {
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
    const balances = await this.providerManager.proxyGetBalances(
      networkId,
      dbAccount,
      tokensToGet,
      withMain,
    );
    const ret: Record<string, string | undefined> = {};
    if (withMain && typeof balances[0] !== 'undefined') {
      ret.main = balances[0]
        .div(new BigNumber(10).pow(network.decimals))
        .toFixed();
    }
    balances.slice(withMain ? 1 : 0).forEach((balance, index) => {
      const tokenId1 = tokensToGet[index];
      const decimals = decimalsMap[tokenId1];
      if (typeof balance !== 'undefined') {
        ret[tokenId1] = balance.div(new BigNumber(10).pow(decimals)).toFixed();
      }
    });
    return ret;
  }

  @backgroundMethod()
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
    const outputFormat = 'pub';
    const accountInfos = getXpubs(
      getImplFromNetworkId(networkId),
      credential.seed,
      password,
      outputFormat,
      start,
      limit,
      purpose,
      dbNetwork.curve,
    );
    const addresses = await Promise.all(
      accountInfos.map((accountInfo) =>
        this.providerManager.addressFromPub(networkId, accountInfo.info),
      ),
    );
    const balances = await this.providerManager.proxyGetBalances(
      networkId,
      addresses,
      [],
    );
    return balances.map((balance, index) => ({
      index: start + index,
      path: accountInfos[index].path,
      displayAddress: addresses[index],
      mainBalance:
        typeof balance === 'undefined'
          ? '0'
          : balance.div(new BigNumber(10).pow(dbNetwork.decimals)).toFixed(),
    }));
  }

  @backgroundMethod()
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
    const outputFormat = 'pub';
    const [accountInfo] = getXpubs(
      getImplFromNetworkId(networkId),
      credential.seed,
      password,
      outputFormat,
      usedIndex,
      1,
      usedPurpose,
      dbNetwork.curve,
    );
    const coinType = implToCoinTypes[impl];
    if (typeof coinType === 'undefined') {
      throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
    }
    const accountType = implToAccountType[impl];
    if (typeof accountType === 'undefined') {
      throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
    }
    let address = '';
    if (accountType === AccountType.VARIANT) {
      address = await this.providerManager.addressFromPub(
        networkId,
        accountInfo.info,
      );
      address = await this.providerManager.addressToBase(networkId, address);
    }

    return this.dbApi
      .addAccountToWallet(walletId, {
        id: `${walletId}--${accountInfo.path}`,
        name: name || '',
        type: accountType,
        path: accountInfo.path,
        coinType,
        pub: accountInfo.info,
        address,
      })
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

  @backgroundMethod()
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
    const impl = getImplFromNetworkId(networkId);
    const coinType = implToCoinTypes[impl];
    if (typeof coinType === 'undefined') {
      throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
    }
    const accountType = implToAccountType[impl];
    if (typeof accountType === 'undefined') {
      throw new OneKeyInternalError(`Unsupported implementation ${impl}.`);
    }

    let address = normalizedAddress;
    if (accountType === AccountType.VARIANT) {
      address = await this.providerManager.addressToBase(networkId, address);
    }

    const a = await this.dbApi.addAccountToWallet('watching', {
      id: `watching--${coinType}--${address}`,
      name: name || '',
      type: accountType,
      path: '',
      coinType,
      pub: '', // TODO: only address is supported for now.
      address,
    });
    return this.getAccount(a.id, networkId);
  }

  @backgroundMethod()
  removeAccount(accountId: string, password: string): Promise<void> {
    // Remove an account. Raise an error if account doesn't exist or password is wrong.
    return this.dbApi.removeAccount(
      getWalletIdFromAccountId(accountId),
      accountId,
      password,
    );
  }

  @backgroundMethod()
  async setAccountName(accountId: string, name: string): Promise<Account> {
    // Rename an account. Raise an error if account doesn't exist.
    // Nothing happens if name is not changed.
    const a = await this.dbApi.setAccountName(accountId, name);
    return this.buildReturnedAccount(a);
  }

  @backgroundMethod()
  private async getOrAddToken(
    networkId: string,
    tokenIdOnNetwork: string,
  ): Promise<Token | undefined> {
    let noThisToken: undefined;
    const { normalizedAddress, isValid } =
      await this.providerManager.verifyTokenAddress(
        networkId,
        tokenIdOnNetwork,
      );
    if (!isValid || typeof normalizedAddress === 'undefined') {
      return noThisToken;
    }

    const tokenId = `${networkId}--${normalizedAddress}`;
    const token = await this.dbApi.getToken(tokenId);
    if (typeof token !== 'undefined') {
      // Already exists in db.
      return token;
    }

    const toAdd = getPresetToken(networkId, normalizedAddress);
    const [tokenInfo] = await this.providerManager.getTokenInfos(networkId, [
      normalizedAddress,
    ]);
    if (typeof tokenInfo === 'undefined') {
      return noThisToken;
    }
    const overwrite: Partial<Token> = {
      id: tokenId,
      decimals: tokenInfo.decimals,
    };
    if (toAdd.decimals === -1 || getImplFromNetworkId(networkId) !== IMPL_SOL) {
      // If the token is not preset or it is not on solana, use the name and
      // symbol retrieved from the network.
      overwrite.name = tokenInfo.name;
      overwrite.symbol = tokenInfo.symbol;
    }
    return this.dbApi.addToken({ ...toAdd, ...overwrite });
  }

  @backgroundMethod()
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

  @backgroundMethod()
  async preAddToken(
    accountId: string,
    networkId: string,
    tokenIdOnNetwork: string,
  ): Promise<[string | undefined, Token] | undefined> {
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
    const [balance] = await this.providerManager.proxyGetBalances(
      networkId,
      dbAccount,
      [tokenIdOnNetwork],
      false,
    );
    if (typeof balance === 'undefined') {
      return undefined;
    }
    return [
      balance.div(new BigNumber(10).pow(token.decimals)).toFixed(),
      token,
    ];
  }

  @backgroundMethod()
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

  @backgroundMethod()
  async getTopTokensOnNetwork(
    networkId: string,
    limit = 50,
  ): Promise<Array<Token>> {
    return Promise.resolve(getPresetTokensOnNetwork(networkId).slice(0, limit));
  }

  @backgroundMethod()
  async searchTokens(
    networkId: string,
    searchTerm: string,
  ): Promise<Array<Token>> {
    if (searchTerm.length === 0) {
      return [];
    }

    const { displayAddress, normalizedAddress, isValid } =
      await this.providerManager.verifyTokenAddress(networkId, searchTerm);

    if (
      isValid &&
      typeof displayAddress !== 'undefined' &&
      typeof normalizedAddress !== 'undefined'
    ) {
      // valid token address, return the specific token.
      let token = await this.dbApi.getToken(
        `${networkId}--${normalizedAddress}`,
      );
      const addressesToTry = new Set([normalizedAddress, displayAddress]);
      addressesToTry.forEach((address) => {
        if (typeof token === 'undefined') {
          const presetToken = getPresetToken(networkId, address);
          if (presetToken.decimals !== -1) {
            token = presetToken;
          }
        }
      });
      return typeof token !== 'undefined' ? [token] : [];
    }
    const matchPattern = new RegExp(searchTerm, 'i');
    const tokens = await this.getTokens(networkId);
    return tokens.filter(
      (token) =>
        token.name.match(matchPattern) || token.symbol.match(matchPattern),
    );
  }

  @backgroundMethod()
  async prepareTransfer(
    networkId: string,
    accountId: string,
    to: string,
    value: string,
    tokenIdOnNetwork?: string,
    extra?: { [key: string]: any },
  ): Promise<string> {
    // For account model networks, return the estimated gas usage.
    // TODO: For UTXO model networks, return the transaction size & selected UTXOs.
    // TODO: validate to parameter.
    const [network, dbAccount] = await Promise.all([
      this.getNetwork(networkId),
      this.dbApi.getAccount(accountId),
    ]);

    // Below properties are used to avoid redundant network requests.
    const payload = extra || {};
    payload.nonce = 1;
    payload.feePricePerUnit = new BigNumber(1);
    return (
      await this.providerManager.preSend(
        network,
        dbAccount,
        to,
        new BigNumber(value),
        tokenIdOnNetwork,
        payload,
      )
    ).toFixed();
  }

  @backgroundMethod()
  async getGasPrice(networkId: string): Promise<Array<string | EIP1559Fee>> {
    const ret = await this.providerManager.getGasPrice(networkId);
    if (ret.length > 0 && ret[0] instanceof BigNumber) {
      const { feeDecimals } = await this.dbApi.getNetwork(networkId);
      return (ret as Array<BigNumber>).map((price: BigNumber) =>
        price.shiftedBy(-feeDecimals).toFixed(),
      );
    }
    return ret as Array<EIP1559Fee>;
  }

  @backgroundMethod()
  async transfer(
    password: string,
    networkId: string,
    accountId: string,
    to: string,
    value: string,
    gasPrice: string,
    gasLimit: string,
    tokenIdOnNetwork?: string,
    extra?: { [key: string]: any },
  ): Promise<{ txid: string; success: boolean }> {
    const [credential, network, dbAccount] = await Promise.all([
      this.dbApi.getCredential(getWalletIdFromAccountId(accountId), password),
      this.getNetwork(networkId),
      this.dbApi.getAccount(accountId),
    ]);

    try {
      const { txid, rawTx, success } =
        await this.providerManager.simpleTransfer(
          credential.seed,
          password,
          network,
          dbAccount,
          to,
          new BigNumber(value),
          tokenIdOnNetwork,
          {
            ...extra,
            feeLimit: new BigNumber(gasLimit),
            feePricePerUnit: new BigNumber(gasPrice),
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
          value,
          rawTx,
        },
      );
      return { txid, success };
    } catch (e) {
      const { message } = e as { message: string };
      throw new FailedToTransfer(message);
    }
  }

  async signMessage(
    password: string,
    networkId: string,
    accountId: string,
    messages: Array<Message>,
    _ref?: string,
  ): Promise<Array<string>> {
    const [credential, network, dbAccount] = await Promise.all([
      this.dbApi.getCredential(getWalletIdFromAccountId(accountId), password),
      this.getNetwork(networkId),
      this.dbApi.getAccount(accountId),
    ]);
    // TODO: address check needed?
    const signatures = await this.providerManager.signMessages(
      credential.seed,
      password,
      network,
      dbAccount,
      messages,
    );
    // TODO: add history
    return signatures;
  }

  // TODO: sign & broadcast.
  // signTransaction
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

  @backgroundMethod()
  async listNetworks(enabledOnly = true): Promise<Array<Network>> {
    const networks = await this.dbApi.listNetworks();
    return networks
      .filter(
        (dbNetwork) =>
          (enabledOnly ? dbNetwork.enabled : true) &&
          SUPPORTED_IMPLS.has(dbNetwork.impl),
      )
      .map((dbNetwork) => fromDBNetworkToNetwork(dbNetwork));
  }

  @backgroundMethod()
  async preAddNetwork(
    rpcURL: string,
    impl = IMPL_EVM,
  ): Promise<{ chainId: string; existingNetwork: Network | undefined }> {
    if (rpcURL.length === 0) {
      throw new OneKeyInternalError('Empty RPC URL.');
    }

    let chainId = '';
    let existingNetwork: Network | undefined;

    switch (impl) {
      case IMPL_EVM:
        chainId = await this.providerManager.getEVMChainId(rpcURL);
        try {
          existingNetwork = await this.getNetwork(`${IMPL_EVM}--${chainId}`);
        } catch (e) {
          console.debug(e);
        }
        break;
      default:
        throw new NotImplemented(
          `Adding network for implemetation ${impl} is not supported.`,
        );
    }

    return { chainId, existingNetwork };
  }

  @backgroundMethod()
  getRPCEndpointStatus(
    rpcURL: string,
    impl: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    if (rpcURL.length === 0) {
      throw new OneKeyInternalError('Empty RPC URL.');
    }

    return getRPCStatus(rpcURL, impl);
  }

  @backgroundMethod()
  async addNetwork(impl: string, params: AddNetworkParams): Promise<Network> {
    if (params.rpcURL === '') {
      throw new OneKeyInternalError(
        'addNetwork: empty value is not allowed for RPC URL.',
      );
    }
    if (params.explorerURL) {
      try {
        const u = new URL(params.explorerURL);
        params.explorerURL = u.toString();
      } catch (error) {
        console.error(error);
        throw new OneKeyInternalError('addNetwork invalid URL');
      }
    }

    let networkId: string | undefined;
    switch (impl) {
      case IMPL_EVM: {
        try {
          networkId = await this.providerManager.getEVMChainId(params.rpcURL);
        } catch (e) {
          console.error(e);
        }
        break;
      }
      default:
        throw new OneKeyInternalError(
          `addNetwork: unsupported implementation ${impl} specified`,
        );
    }
    if (typeof networkId === 'undefined') {
      throw new OneKeyInternalError('addNetwork: failed to get network id.');
    }
    const dbObj = await this.dbApi.addNetwork(
      getEVMNetworkToCreate(`${impl}--${networkId}`, params),
    );
    return fromDBNetworkToNetwork(dbObj);
  }

  @backgroundMethod()
  async getNetwork(networkId: string): Promise<Network> {
    const dbObj = await this.dbApi.getNetwork(networkId);
    return fromDBNetworkToNetwork(dbObj);
  }

  @backgroundMethod()
  async updateNetworkList(
    networks: Array<[string, boolean]>,
  ): Promise<Array<Network>> {
    await this.dbApi.updateNetworkList(networks);
    return this.listNetworks(false);
  }

  @backgroundMethod()
  async updateNetwork(
    networkId: string,
    params: UpdateNetworkParams,
  ): Promise<Network> {
    if (Object.keys(params).length === 0) {
      throw new OneKeyInternalError('updateNetwork: params is empty.');
    }
    if (params.explorerURL) {
      try {
        const u = new URL(params.explorerURL);
        params.explorerURL = u.toString();
      } catch (error) {
        console.error(error);
        throw new OneKeyInternalError('updateNetwork invalid URL');
      }
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

  @backgroundMethod()
  deleteNetwork(networkId: string): Promise<void> {
    if (networkIsPreset(networkId)) {
      throw new OneKeyInternalError('Preset network cannot be deleted.');
    }
    return this.dbApi.deleteNetwork(networkId);
  }

  @backgroundMethod()
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

  @backgroundMethod()
  async getTxHistories(
    networkId: string,
    accountId: string,
    pageNumber: number,
    pageSize: number,
  ) {
    const [dbAccount, network] = await Promise.all([
      this.dbApi.getAccount(accountId),
      this.getNetwork(networkId),
    ]);

    if (network.impl !== IMPL_EVM) {
      return { data: null, error: false, errorMessage: null, errorCode: null };
    }

    if (typeof dbAccount === 'undefined') {
      return { data: null, error: false, errorMessage: null, errorCode: null };
    }

    if (dbAccount.type !== AccountType.SIMPLE) {
      return { data: null, error: false, errorMessage: null, errorCode: null };
    }
    const chainId = network.id.split(SEPERATOR)[1];

    return getTxHistories(chainId, dbAccount.address, pageNumber, pageSize);
  }

  async getErc20TxHistories(
    networkId: string,
    accountId: string,
    contract: string,
    pageNumber: number,
    pageSize: number,
  ) {
    const [dbAccount, network] = await Promise.all([
      this.dbApi.getAccount(accountId),
      this.getNetwork(networkId),
    ]);

    if (network.impl !== IMPL_EVM) {
      return { data: null, error: false, errorMessage: null, errorCode: null };
    }

    if (typeof dbAccount === 'undefined') {
      return { data: null, error: false, errorMessage: null, errorCode: null };
    }

    if (dbAccount.type !== AccountType.SIMPLE) {
      return { data: null, error: false, errorMessage: null, errorCode: null };
    }

    const chainId = network.id.split(SEPERATOR)[1];
    return getErc20TransferHistories(
      chainId,
      dbAccount.address,
      contract,
      pageNumber,
      pageSize,
    );
  }

  @backgroundMethod()
  proxyRPCCall<T>(networkId: string, request: IJsonRpcRequest): Promise<T> {
    return this.providerManager.proxyRPCCall(networkId, request);
  }

  @backgroundMethod()
  async getPrices(
    networkId: string,
    tokenIdsOnNetwork: Array<string>,
    withMain = true,
  ): Promise<Record<string, string>> {
    // Get price info.
    const ret: Record<string, string> = {};
    const prices = await this.priceManager.getPrices(
      networkId,
      tokenIdsOnNetwork.filter(
        (tokenIdOnNetwork) => tokenIdOnNetwork.length > 0,
      ),
      withMain,
    );
    Object.keys(prices).forEach((k) => {
      ret[k] = prices[k].toFixed();
    });
    return ret;
  }

  @backgroundMethod()
  async listFiats(): Promise<Record<string, string>> {
    const ret: Record<string, string> = {};
    const fiats = await this.priceManager.getFiats(
      new Set(['usd', 'cny', 'jpy', 'hkd']),
    );
    Object.keys(fiats).forEach((f) => {
      ret[f] = fiats[f].sd(6).toFixed();
    });
    return ret;
  }

  setFiat(symbol: string): Promise<void> {
    // Set fiat symbol that is used throughout the app.
    console.log(`setFiat ${symbol}`);
    throw new NotImplemented();
  }

  @backgroundMethod()
  updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    // Update global password.
    return this.dbApi.updatePassword(oldPassword, newPassword);
  }

  @backgroundMethod()
  async isMasterPasswordSet(): Promise<boolean> {
    const context = await this.dbApi.getContext();
    return (
      typeof context !== 'undefined' &&
      context.verifyString !== DEFAULT_VERIFY_STRING
    );
  }

  @backgroundMethod()
  async verifyMasterPassword(password: string): Promise<boolean> {
    const context = await this.dbApi.getContext();
    if (
      typeof context !== 'undefined' &&
      context.verifyString !== DEFAULT_VERIFY_STRING
    ) {
      return checkPassword(context, password);
    }
    return true;
  }

  @backgroundMethod()
  async resetApp(): Promise<void> {
    // Reset app.
    await this.dbApi.reset();
    this.dbApi = new DbApi() as DBAPI;
    return Promise.resolve();
  }
}

export { Engine };
