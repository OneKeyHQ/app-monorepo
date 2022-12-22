/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
/* eslint max-classes-per-file: "off" */

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import { HISTORY_CONSTS } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import simpleDb from '../dbs/simple/simpleDb';
import {
  InvalidAddress,
  InvalidTokenAddress,
  NotImplemented,
  PendingQueueTooLong,
} from '../errors';
import { IMPL_MAPPINGS } from '../proxyUtils';

import { IDecodedTxActionType, IDecodedTxDirection } from './types';
import { VaultContext } from './VaultContext';

import type { Account, DBAccount } from '../types/account';
import type { HistoryEntry, HistoryEntryStatus } from '../types/history';
import type { WalletType } from '../types/wallet';
import type { IEncodedTxEvm } from './impl/evm/Vault';
import type { KeyringBase, KeyringBaseMock } from './keyring/KeyringBase';
import type {
  IApproveInfo,
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
import type { ethers } from '@onekeyfe/blockchain-libs';
import type {
  BaseClient,
  BaseProvider,
} from '@onekeyfe/blockchain-libs/dist/provider/abc';
import type {
  PartialTokenInfo,
  TransactionStatus,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
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

  engineProvider!: BaseProvider;

  async initProvider() {
    const networkImpl = (await this.getNetwork()).impl;
    if (isNil(IMPL_MAPPINGS[networkImpl])) {
      return;
    }

    this.engineProvider = await this.engine.providerManager.getProvider(
      this.networkId,
    );
  }

  // Methods not related to a single account, but implementation.

  async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    throw new NotImplemented();
  }

  abstract createClientFromURL(url: string): BaseClient;

  async getEthersProvider(): Promise<ethers.providers.JsonRpcProvider> {
    throw new NotImplemented();
  }

  async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = this.createClientFromURL(url);
    const start = performance.now();
    const latestBlock = (await client.getInfo()).bestBlockNumber;
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  abstract fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>>;

  async validateAddress(address: string): Promise<string> {
    const { normalizedAddress, isValid } =
      await this.engineProvider.verifyAddress(address);
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }
    return Promise.resolve(normalizedAddress);
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
        (await this.engineProvider.verifyAddress(input)).isValid,
    );
  }

  async validateTokenAddress(address: string): Promise<string> {
    const { normalizedAddress, isValid } =
      await this.engineProvider.verifyTokenAddress(address);
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidTokenAddress();
    }
    return Promise.resolve(normalizedAddress);
  }

  async checkAccountExistence(accountIdOnNetwork: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ) {
    // Abstract requests
    const client = await this.engine.providerManager.getClient(this.networkId);
    return client.getBalances(
      requests.map(({ address, tokenAddress }) => ({
        address,
        coin: { ...(typeof tokenAddress === 'string' ? { tokenAddress } : {}) },
      })),
    );
  }

  async getFrozenBalance(): Promise<number | Record<string, number>> {
    return 0;
  }

  getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    return this.engine.providerManager.getTransactionStatuses(
      this.networkId,
      txids,
    );
  }

  getTransactionFeeInNative(txid: string): Promise<string> {
    return Promise.resolve('');
  }

  async isContractAddress(address: string): Promise<boolean> {
    return false;
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
  keyring!: KeyringBase;

  helper!: VaultHelperBase;

  abstract keyringMap: Record<IKeyringMapKey, typeof KeyringBaseMock>;

  async init(config: IVaultInitConfig) {
    await this.initProvider();
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
  abstract buildEncodedTxFromApprove(
    approveInfo: IApproveInfo,
  ): Promise<IEncodedTx>;

  // TODO move to EVM only
  abstract updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx>;

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

  async broadcastTransaction(
    signedTx: ISignedTxPro,
    options?: any,
  ): Promise<ISignedTxPro> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    // TODO RPC Error format return: EIP-1474 EIP-1193
    const txid = await this.engine.providerManager.broadcastTransaction(
      this.networkId,
      signedTx.rawTx,
      options,
    );
    debugLogger.engine.info('broadcastTransaction END:', {
      txid,
      rawTx: signedTx.rawTx,
    });
    return {
      ...signedTx,
      txid,
      encodedTx: signedTx.encodedTx,
    };
  }

  async buildEncodedTxFromBatchTransfer(
    transferInfos: ITransferInfo[],
    prevNonce?: number,
  ): Promise<IEncodedTx> {
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
    };
  }

  async getAccountBalance(tokenIds: Array<string>, withMain = true) {
    const { address } = await this.getDbAccount();
    return this.getBalances(
      (withMain ? [{ address }] : []).concat(
        tokenIds.map((tokenAddress) => ({ address, tokenAddress })),
      ),
    );
  }

  // TODO move to keyring
  abstract getExportedCredential(password: string): Promise<string>;

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

  // TODO abstract method
  async fetchOnChainHistory(options: {
    // ""=NativeToken   "0x88836623"=Erc20Token    undefined=ALL
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
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

  async getNextNonce(networkId: string, dbAccount: DBAccount): Promise<number> {
    const onChainNonce =
      (
        await this.engine.providerManager.getAddresses(networkId, [
          dbAccount.address,
        ])
      )[0]?.nonce ?? 0;

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

  getPrivateKeyByCredential(credential: string): Buffer | undefined {
    return Buffer.from(
      credential.startsWith('0x') ? credential.slice(2) : credential,
      'hex',
    );
  }
}
