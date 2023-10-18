/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
/* eslint max-classes-per-file: "off" */

import BigNumber from 'bignumber.js';
import { get, isNil, omit } from 'lodash';
import uuidLib from 'react-native-uuid';

import type { BaseClient } from '@onekeyhq/engine/src/client/BaseClient';
import type {
  FeePricePerUnit,
  PartialTokenInfo,
  TransactionStatus,
} from '@onekeyhq/engine/src/types/provider';
import { HISTORY_CONSTS } from '@onekeyhq/shared/src/engine/engineConsts';
import {
  InvalidTokenAddress,
  NotImplemented,
  PendingQueueTooLong,
} from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import simpleDb from '../dbs/simple/simpleDb';
import { getBlockNativeGasInfo } from '../managers/blockNative';
import { getAccountNameInfoByImpl } from '../managers/impl';
import { getMetaMaskGasInfo } from '../managers/metaMask';

import { IDecodedTxActionType, IDecodedTxDirection } from './types';
import { VaultContext } from './VaultContext';

import type {
  Account,
  AccountCredentialType,
  BtcForkChainUsedAccount,
  DBAccount,
} from '../types/account';
import type { BlockNativeGasInfo } from '../types/blockNative';
import type { HistoryEntry, HistoryEntryStatus } from '../types/history';
import type { MetaMaskGasInfo } from '../types/metaMask';
import type { AccountNameInfo, EIP1559Fee, Network } from '../types/network';
import type { NFTAssetMeta, NFTListItems } from '../types/nft';
import type { WalletType } from '../types/wallet';
import type { Geth } from './impl/evm/client/geth';
import type { ethers } from './impl/evm/sdk/ethers';
import type { IEncodedTxEvm } from './impl/evm/Vault';
import type { KeyringBase, KeyringBaseMock } from './keyring/KeyringBase';
import type {
  IApproveInfo,
  IBalanceDetails,
  IClientEndpointStatus,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISetApprovalForAll,
  ISignCredentialOptions,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
  IVaultSettings,
} from './types';
import type { VaultHelperBase } from './VaultHelperBase';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

export type IVaultInitConfig = {
  keyringCreator: (vault: VaultBase) => Promise<KeyringBase>;
};
export type IKeyringMapKey = WalletType;

if (platformEnv.isExtensionUi) {
  debugger;
  throw new Error('engine/VaultBase is not allowed imported from ui');
}

export abstract class VaultBaseChainOnly extends VaultContext {
  abstract settings: IVaultSettings;

  // Methods not related to a single account, but implementation.

  async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    throw new NotImplemented();
  }

  createClientFromURL(url: string): BaseClient {
    throw new NotImplemented();
  }

  async getEthersProvider(): Promise<ethers.providers.JsonRpcProvider> {
    throw new NotImplemented();
  }

  async getClientEndpointStatus(url: string): Promise<IClientEndpointStatus> {
    const client = this.createClientFromURL(url);
    const start = performance.now();
    const latestBlock = (await client.getInfo()).bestBlockNumber;
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  async checkRpcBatchSupport(url: string): Promise<IClientEndpointStatus> {
    throw new NotImplemented();
  }

  abstract fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>>;

  async getDisplayAddress(address: string): Promise<string> {
    return Promise.resolve(address);
  }

  /*
  export type AddressValidation = {
    isValid: boolean;
    normalizedAddress?: string;
    displayAddress?: string;
    encoding?: string;
  };
  throw new InvalidAddress();
  */
  abstract validateAddress(address: string): Promise<string>;

  async validateTokenAddress(address: string): Promise<string> {
    throw new InvalidTokenAddress();
  }

  validateImportedCredential(input: string): Promise<boolean> {
    // Generic private key test, override if needed.
    return Promise.resolve(
      this.settings.importedAccountEnabled &&
        /^(0x)?[0-9a-zA-Z]{64}$/.test(input),
    );
  }

  async validateWatchingCredential(input: string): Promise<boolean> {
    // Generic address test, override if needed.
    return Promise.resolve(
      this.settings.watchingAccountEnabled &&
        Boolean(await this.validateAddress(input)),
    );
  }

  async validateCanCreateNextAccount(walletId: string, template: string) {
    return Promise.resolve(true);
  }

  async checkAccountExistence(
    accountIdOnNetwork: string,
    useAddress?: boolean,
  ): Promise<boolean> {
    return Promise.resolve(true);
  }

  abstract getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
    password?: string,
    passwordLoadedCallback?: (isLoaded: boolean) => void,
  ): Promise<Array<BigNumber | undefined>>;

  async getFrozenBalance({
    password,
    useRecycleBalance,
  }: { password?: string; useRecycleBalance?: boolean } = {}): Promise<
    number | Record<string, number>
  > {
    return 0;
  }

  async fetchBalanceDetails({
    password,
    useRecycleBalance,
  }: { password?: string; useRecycleBalance?: boolean } = {}): Promise<
    IBalanceDetails | undefined
  > {
    return Promise.resolve(undefined);
  }

  abstract getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>>;

  getTransactionFeeInNative(txid: string): Promise<string> {
    return Promise.resolve('');
  }

  async isContractAddress(address: string): Promise<boolean> {
    return false;
  }

  async getAccountNameInfoMap(): Promise<Record<string, AccountNameInfo>> {
    const network = await this.getNetwork();
    let accountNameInfo = getAccountNameInfoByImpl(network.impl);
    const omitKeys: string[] = [];
    Object.entries(accountNameInfo).forEach(([key, info]) => {
      if (!info.enableCondition) {
        return;
      }
      if (
        info.enableCondition.networkId &&
        info.enableCondition.networkId !== network.id
      ) {
        omitKeys.push(key);
      }
    });
    accountNameInfo = omit(accountNameInfo, omitKeys);
    return accountNameInfo;
  }

  async canAutoCreateNextAccount(password: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  async filterAccounts({
    accounts,
    networkId,
  }: {
    accounts: DBAccount[];
    networkId: string;
  }): Promise<DBAccount[]> {
    return Promise.resolve(accounts);
  }

  async shouldChangeAccountWhenNetworkChanged({
    previousNetwork,
    newNetwork,
    activeAccountId,
  }: {
    previousNetwork: Network | undefined;
    newNetwork: Network | undefined;
    activeAccountId: string | null;
  }): Promise<{
    shouldReloadAccountList: boolean;
    shouldChangeActiveAccount: boolean;
  }> {
    return Promise.resolve({
      shouldReloadAccountList: false,
      shouldChangeActiveAccount: false,
    });
  }

  async getAccountNameInfosByImportedOrWatchingCredential(
    input: string,
  ): Promise<AccountNameInfo[]> {
    return Promise.resolve([]);
  }

  async checkIsUnlimitedAllowance(params: {
    owner: string;
    spender: string;
    token: string;
  }): Promise<{ isUnlimited: boolean; allowance: string | number }> {
    throw new NotImplemented();
  }

  async checkIsApprovedForAll(params: {
    owner: string;
    spender: string;
    token: string;
    type?: string;
  }): Promise<boolean> {
    throw new NotImplemented();
  }

  async checkIsBatchTransfer(encodedTx: IEncodedTx): Promise<boolean> {
    throw new NotImplemented();
  }

  async getFeePricePerUnit(): Promise<FeePricePerUnit> {
    throw new NotImplemented();
  }

  async fetchRpcChainId(url: string): Promise<string | null> {
    return null;
  }

  async getTxWaitingSeconds(): Promise<Array<number>> {
    return [];
  }

  async getUserNFTAssets({
    serviceData,
  }: {
    serviceData: NFTListItems;
  }): Promise<NFTAssetMeta | undefined> {
    return Promise.resolve(undefined);
  }

  async _getGasInfoFromApi(
    networkId: string,
  ): Promise<Partial<MetaMaskGasInfo & BlockNativeGasInfo>> {
    return new Promise((resolve, reject) => {
      let metaMaskGasInfoInit = false;
      let metaMaskGasInfo: MetaMaskGasInfo | null = null;
      let blockNativeGasInfoInit = false;
      let blockNativeGasInfo: BlockNativeGasInfo | null = null;
      getBlockNativeGasInfo({ networkId })
        .then((gasInfo) => {
          blockNativeGasInfo = gasInfo;
        })
        .catch((e) => console.warn(e))
        .finally(() => {
          blockNativeGasInfoInit = true;
          if (metaMaskGasInfoInit) {
            if (blockNativeGasInfo || metaMaskGasInfo) {
              resolve({
                ...metaMaskGasInfo,
                ...blockNativeGasInfo,
              });
            } else {
              reject();
            }
          }
        });
      getMetaMaskGasInfo(networkId)
        .then((gasInfo) => {
          metaMaskGasInfo = gasInfo;
        })
        .catch((e) => console.warn(e))
        .finally(() => {
          metaMaskGasInfoInit = true;
          if (blockNativeGasInfoInit) {
            if (blockNativeGasInfo || metaMaskGasInfo) {
              resolve({
                ...metaMaskGasInfo,
                ...blockNativeGasInfo,
              });
            } else {
              reject();
            }
          }
        });
    });
  }

  async _getGasInfoByVaultClient(client: BaseClient): Promise<
    | {
        prices: Array<BigNumber | EIP1559Fee>;
        networkCongestion?: number;
        estimatedTransactionCount?: number;
      }
    | undefined
  > {
    const { EIP1559Enabled } = (await this.getChainInfo()).implOptions || {};
    if (EIP1559Enabled || false) {
      try {
        const { networkId } = this;
        const gasInfo = await this._getGasInfoFromApi(networkId);
        return {
          ...gasInfo,
          prices: gasInfo.prices as EIP1559Fee[],
        };
      } catch {
        const {
          baseFeePerGas,
          reward,
        }: { baseFeePerGas: Array<string>; reward: Array<Array<string>> } =
          await (client as Geth).rpc.call('eth_feeHistory', [
            20,
            'latest',
            [5, 25, 60],
          ]);
        const baseFee = new BigNumber(baseFeePerGas.pop() as string).shiftedBy(
          -9,
        );
        const [lows, mediums, highs]: [
          Array<BigNumber>,
          Array<BigNumber>,
          Array<BigNumber>,
        ] = [[], [], []];
        reward.forEach((priorityFees: Array<string>) => {
          lows.push(new BigNumber(priorityFees[0]));
          mediums.push(new BigNumber(priorityFees[1]));
          highs.push(new BigNumber(priorityFees[2]));
        });
        const coefficients = ['1.13', '1.25', '1.3'].map(
          (c) => new BigNumber(c),
        );
        return {
          prices: [lows, mediums, highs].map((rewardList, index) => {
            const coefficient = coefficients[index];
            const maxPriorityFeePerGas = rewardList
              .sort((a, b) => (a.gt(b) ? 1 : -1))[11]
              .shiftedBy(-9);
            return {
              baseFee: baseFee.toFixed(),
              maxPriorityFeePerGas: maxPriorityFeePerGas.toFixed(),
              maxFeePerGas: baseFee
                .times(new BigNumber(coefficient))
                .plus(maxPriorityFeePerGas)
                .toFixed(),
            };
          }),
        };
      }
    } else {
      const count = 3;
      const result = await client.getFeePricePerUnit();
      if (result) {
        return {
          prices: [result.normal, ...(result.others || [])]
            .sort((a, b) => (a.price.gt(b.price) ? 1 : -1))
            .map((p) => p.price)
            .slice(0, count),
        };
      }
    }
  }

  async baseGetGasInfo(client: BaseClient): Promise<{
    prices: Array<string | EIP1559Fee>;
    networkCongestion?: number;
    estimatedTransactionCount?: number;
  }> {
    const gasInfo = await this._getGasInfoByVaultClient(client);
    let prices = [];

    if (gasInfo === undefined) {
      const result = await this.getFeePricePerUnit();
      prices = [result.normal, ...(result.others || [])]
        .sort((a, b) => (a.price.gt(b.price) ? 1 : -1))
        .map((p) => p.price)
        .slice(0, 3);
    } else {
      prices = gasInfo.prices;
    }

    if (prices.length > 0 && prices[0] instanceof BigNumber) {
      const { feeDecimals } = await this.getNetwork();
      return {
        ...gasInfo,
        prices: (prices as Array<BigNumber>).map((price: BigNumber) =>
          price.shiftedBy(-feeDecimals).toFixed(),
        ),
      };
    }
    return gasInfo as { prices: EIP1559Fee[] };
  }

  async getGasInfo(): Promise<{
    prices: Array<string | EIP1559Fee>;
    networkCongestion?: number;
    estimatedTransactionCount?: number;
  }> {
    // const client = await this.getJsonRPCClient();
    // return this.baseGetGasInfo(client);
    throw new NotImplemented();
  }
}

/*
TODO
- validator to vault
- fetchTokenList: packages/engine/src/presets/token.ts
  - searchTokens from DB
    - remove regex match
  - remove token list in memory
  - check version and save
    - fetch cdn
    - require(npm) fallback
    - save to DB
    - correct decimals
- fetchTokenInfo: single token info
  - tokenInfo on chain
  - tokenInfo on tokenList
  - merge tokenInfo
 */
export abstract class VaultBase extends VaultBaseChainOnly {
  uuid: string = uuidLib.v4().toString();

  keyring!: KeyringBase;

  helper!: VaultHelperBase;

  abstract keyringMap: Record<IKeyringMapKey, typeof KeyringBaseMock>;

  async init(config: IVaultInitConfig) {
    await this.initKeyring(config);
  }

  async initKeyring(config: IVaultInitConfig) {
    this.keyring = await config.keyringCreator(this);
  }

  abstract attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTx>;

  // TODO rename buildDecodedTx:
  //    - _decodeTx
  //    - fixDecodedTx
  //    - append payload to decodedTx
  abstract decodeTx(encodedTx: IEncodedTx, payload?: any): Promise<IDecodedTx>;

  // abstract _decodeTx(encodedTx: IEncodedTx, payload?: any): Promise<IDecodedTx>;

  abstract decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy>;

  abstract buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTx>;

  // TODO move to EVM only
  buildEncodedTxFromApprove(approveInfo: IApproveInfo): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  // TODO move to EVM only
  updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  abstract updateEncodedTx(
    encodedTx: IEncodedTx,
    // TODO merge payload to options, just like IDecodedTxAction
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx>;

  // buildEncodedTxFromNftTransfer
  // buildEncodedTxFromSwap

  // TODO return { UnsignedTx, IEncodedTx } , IEncodedTx may be modified
  abstract buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTx,
  ): Promise<IUnsignedTxPro>;

  abstract fetchFeeInfo(
    encodedTx: IEncodedTx,
    signOnly?: boolean,
    specifiedFeeRate?: string,
    transferCount?: number,
  ): Promise<IFeeInfo>;

  // DO NOT override this method
  async signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ) {
    return this.keyring.signTransaction(unsignedTx, options);
  }

  // TODO DO NOT override this method, override broadcastTransaction instead.
  async signAndSendTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
    signOnly: boolean,
  ): Promise<ISignedTxPro> {
    const signedTx = await this.signTransaction(unsignedTx, options);
    if (signOnly) {
      return { ...signedTx, encodedTx: unsignedTx.encodedTx };
    }
    return this.broadcastTransaction({
      ...signedTx,
      encodedTx: unsignedTx.encodedTx,
    });
  }

  abstract broadcastTransaction(
    signedTx: ISignedTxPro,
    options?: any,
  ): Promise<ISignedTxPro>;

  async buildEncodedTxFromBatchTransfer(params: {
    transferInfos: ITransferInfo[];
    prevNonce?: number;
    isDeflationary?: boolean;
    specifiedFeeRate?: string;
  }): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  async buildEncodedTxsFromSetApproveForAll(
    approveInfos: ISetApprovalForAll[],
    prevNonce?: number,
  ): Promise<IEncodedTx[]> {
    throw new NotImplemented();
  }

  // TODO: is currently a mint
  async activateAccount() {
    throw new NotImplemented();
  }

  async activateToken(
    tokenAddress: string,
    password: string,
  ): Promise<boolean> {
    throw new NotImplemented();
  }

  async getTokenAllowance(
    tokenAddress: string,
    spenderAddress: string,
  ): Promise<BigNumber> {
    throw new NotImplemented();
  }

  async batchTokensAllowance(
    tokenAddress: string,
    spenderAddress: string[],
  ): Promise<number[]> {
    throw new NotImplemented();
  }

  async getOutputAccount(): Promise<Account> {
    // The simplest case as default implementation.
    const dbAccount = await this.getDbAccount({ noCache: true });
    return {
      id: dbAccount.id,
      name: dbAccount.name,
      type: dbAccount.type,
      path: dbAccount.path,
      coinType: dbAccount.coinType,
      tokens: [],
      address: dbAccount.address,
      template: dbAccount.template,
      pubKey: get(dbAccount, 'pub', ''),
    };
  }

  async getAccountBalance(
    tokenIds: Array<string>,
    withMain = true,
    password?: string,
    passwordLoadedCallback?: (isLoaded: boolean) => void,
  ) {
    const { address } = await this.getDbAccount();
    return this.getBalances(
      (withMain ? [{ address }] : []).concat(
        tokenIds.map((tokenAddress) => ({ address, tokenAddress })),
      ),
      password,
      passwordLoadedCallback,
    );
  }

  // TODO move to keyring
  abstract getExportedCredential(
    password: string,
    credentialType: AccountCredentialType,
  ): Promise<string>;

  async updatePendingTxs(
    pendingTxs: Array<HistoryEntry>,
  ): Promise<Record<string, HistoryEntryStatus>> {
    throw new NotImplemented();
  }

  async getAccountNonce(): Promise<number | null> {
    return Promise.resolve(null);
  }

  async fixActionDirection({
    action,
    accountAddress,
  }: {
    action: IDecodedTxAction;
    accountAddress: string;
  }) {
    action.direction = IDecodedTxDirection.OTHER;
    if (action.type === IDecodedTxActionType.NATIVE_TRANSFER) {
      action.direction = await this.buildTxActionDirection({
        from: action.nativeTransfer?.from || '',
        to: action.nativeTransfer?.to || '',
        address: accountAddress,
      });
    }
    if (action.type === IDecodedTxActionType.TOKEN_TRANSFER) {
      action.direction = await this.buildTxActionDirection({
        from: action.tokenTransfer?.from || '',
        to: action.tokenTransfer?.to || '',
        address: accountAddress,
      });
    }
    return action;
  }

  async fixDecodedTx(decodedTx: IDecodedTx): Promise<IDecodedTx> {
    decodedTx.createdAt = decodedTx.createdAt ?? Date.now();

    // TODO try catch and define utils function
    const nonce = (decodedTx.encodedTx as IEncodedTxEvm)?.nonce;
    decodedTx.nonce = !isNil(nonce)
      ? new BigNumber(nonce).toNumber()
      : decodedTx.nonce;

    // TODO fix tx action direction both at SendConfirm
    const accountAddress = decodedTx.owner;
    for (let i = 0; i < decodedTx.actions.length; i += 1) {
      const action = decodedTx.actions[i];
      await this.fixActionDirection({
        action,
        accountAddress,
      });
    }
    if (decodedTx.outputActions) {
      for (let i = 0; i < decodedTx.outputActions.length; i += 1) {
        const action = decodedTx.outputActions[i];
        await this.fixActionDirection({
          action,
          accountAddress,
        });
      }
    }

    return Promise.resolve(decodedTx);
  }

  async fixHistoryTx(historyTx: IHistoryTx): Promise<IHistoryTx> {
    historyTx.decodedTx = await this.fixDecodedTx(historyTx.decodedTx);
    if (platformEnv.isDev && platformEnv.isDesktop) {
      Object.assign(historyTx, {
        _tmpCreatedAtText: new Date(
          historyTx.decodedTx.createdAt || 0,
        ).toLocaleString(),
        _tmpUpdatedAtText: new Date(
          historyTx.decodedTx.updatedAt || 0,
        ).toLocaleString(),
        _tmpStatus: historyTx.decodedTx.status,
        _tmpIsFinal: historyTx.decodedTx.isFinal,
      });
    }
    return Promise.resolve(historyTx);
  }

  async buildHistoryTx({
    historyTxToMerge,
    encodedTx,
    decodedTx,
    signedTx,
    isSigner,
    isLocalCreated,
  }: {
    historyTxToMerge?: IHistoryTx;
    encodedTx?: IEncodedTx | null;
    decodedTx: IDecodedTx;
    signedTx?: ISignedTxPro;
    isSigner?: boolean;
    isLocalCreated?: boolean;
  }): Promise<IHistoryTx> {
    const txid: string = signedTx?.txid || decodedTx?.txid || '';
    if (!txid) {
      throw new Error('buildHistoryTx txid not found');
    }
    const address = await this.getAccountAddress();
    decodedTx.txid = txid || decodedTx.txid;
    decodedTx.owner = address;
    if (isSigner) {
      decodedTx.signer = address;
    }
    if (signedTx?.txKey) {
      if (decodedTx.extraInfo) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        decodedTx.extraInfo.txKey = signedTx.txKey;
      } else {
        decodedTx.extraInfo = {
          txKey: signedTx.txKey,
        };
      }
    }
    // TODO base.mergeDecodedTx with signedTx.rawTx
    // must include accountId here, so that two account wont share same tx history
    const historyId = `${this.networkId}_${txid}_${this.accountId}`;
    let historyTx: IHistoryTx = {
      id: historyId,

      isLocalCreated: Boolean(isLocalCreated),

      ...historyTxToMerge,

      decodedTx,
    };
    // TODO update encodedTx nonce from signedTx.rawTx
    historyTx = await this.fixHistoryTx(historyTx);
    return Promise.resolve(historyTx);
  }

  async checkIsScamHistoryTx(historyTx: IHistoryTx) {
    return false;
  }

  // TODO abstract method
  async fetchOnChainHistory(options: {
    // ""=NativeToken   "0x88836623"=Erc20Token    undefined=ALL
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
    password?: string;
    passwordLoadedCallback?: (isLoaded: boolean) => void;
  }): Promise<IHistoryTx[]> {
    throw new NotImplemented();
  }

  fixAddressCase(address: string): Promise<string> {
    // TODO replace `engineUtils.fixAddressCase`
    return Promise.resolve(address);
  }

  async buildTxActionDirection({
    from,
    to,
    address,
  }: {
    from?: string;
    to: string;
    address: string;
  }) {
    // eslint-disable-next-line no-param-reassign
    from = await this.fixAddressCase(from || '');
    // eslint-disable-next-line no-param-reassign
    to = await this.fixAddressCase(to);
    // eslint-disable-next-line no-param-reassign
    address = await this.fixAddressCase(address);
    if (from === to && from === address) {
      return IDecodedTxDirection.SELF;
    }
    // out first for internal send
    if (from && from === address) {
      return IDecodedTxDirection.OUT;
    }
    if (to && to === address) {
      return IDecodedTxDirection.IN;
    }
    return IDecodedTxDirection.OTHER;
  }

  async baseGetNextNonce({
    onChainNonce,
  }: {
    onChainNonce: number;
  }): Promise<number> {
    const { networkId } = this;
    const dbAccount = await this.getDbAccount();

    // TODO: Although 100 history items should be enough to cover all the
    // pending transactions, we need to find a more reliable way.
    const historyItems = await this.engine.getHistory(
      networkId,
      dbAccount.id,
      undefined,
      false,
    );
    const maxPendingNonce = await simpleDb.history.getMaxPendingNonce({
      accountId: this.accountId,
      networkId,
    });
    const pendingNonceList = await simpleDb.history.getPendingNonceList({
      accountId: this.accountId,
      networkId,
    });
    let nextNonce = Math.max(
      isNil(maxPendingNonce) ? 0 : maxPendingNonce + 1,
      onChainNonce,
    );
    if (Number.isNaN(nextNonce)) {
      nextNonce = onChainNonce;
    }
    if (nextNonce > onChainNonce) {
      for (let i = onChainNonce; i < nextNonce; i += 1) {
        if (!pendingNonceList.includes(i)) {
          nextNonce = i;
          break;
        }
      }
    }

    if (nextNonce < onChainNonce) {
      nextNonce = onChainNonce;
    }

    if (nextNonce - onChainNonce >= HISTORY_CONSTS.PENDING_QUEUE_MAX_LENGTH) {
      throw new PendingQueueTooLong(HISTORY_CONSTS.PENDING_QUEUE_MAX_LENGTH);
    }

    return nextNonce;
  }

  async getNextNonce(): Promise<number> {
    // const dbAccount = await this.getDbAccount();
    // const client = await this.getJsonRPCClient();
    // const onChainNonce =
    //   (await client.getAddresses([dbAccount.address]))[0]?.nonce ?? 0;
    // return this.baseGetNextNonce({ onChainNonce });
    throw new NotImplemented();
  }

  validateSendAmount(amount: string, tokenBalance: string, to: string) {
    return Promise.resolve(true);
  }

  notifyChainChanged(currentNetworkId: string, previousNetworkId: string) {}

  /**
   * Most of the chains use the address to check the balance.
   * The utxo model chain needs to use xpub to check the balance
   * Cardano requires the stake address to check the balance
   */
  getFetchBalanceAddress(account: DBAccount | Account) {
    return Promise.resolve(account.address);
  }

  getPrivateKeyByCredential(credential: string): Promise<Buffer | undefined> {
    return Promise.resolve(
      Buffer.from(
        credential.startsWith('0x') ? credential.slice(2) : credential,
        'hex',
      ),
    );
  }

  async getMinDepositAmount(): Promise<BigNumber.Value> {
    return '0';
  }

  async specialCheckEncodedTx(encodedTx: IEncodedTx): Promise<{
    success: boolean;
    key?: string;
    params?: Record<string, any>;
  }> {
    return { success: true };
  }

  async getAllUsedAddress(): Promise<BtcForkChainUsedAccount[]> {
    return Promise.resolve([]);
  }
}
