/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
/* eslint max-classes-per-file: "off" */

import {
  BaseClient,
  BaseProvider,
} from '@onekeyfe/blockchain-libs/dist/provider/abc';
import { PartialTokenInfo } from '@onekeyfe/blockchain-libs/dist/types/provider';
import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import BigNumber from 'bignumber.js';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { InvalidAddress, InvalidTokenAddress, NotImplemented } from '../errors';
import { Account } from '../types/account';
import { HistoryEntry, HistoryEntryStatus } from '../types/history';
import { WalletType } from '../types/wallet';

import {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ITransferInfo,
} from './types';
import { VaultContext } from './VaultContext';

import type { KeyringBase, KeyringBaseMock } from './keyring/KeyringBase';
import type {
  ISignCredentialOptions,
  ISignedTx,
  IVaultSettings,
} from './types';
import type { VaultHelperBase } from './VaultHelperBase';
import type { UnsignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

export type IVaultInitConfig = {
  keyringCreator: (vault: VaultBase) => Promise<KeyringBase>;
};
export type IKeyringMapKey = WalletType;

export abstract class VaultBaseChainOnly extends VaultContext {
  abstract settings: IVaultSettings;

  engineProvider!: BaseProvider;

  async initProvider() {
    this.engineProvider = await this.engine.providerManager.getProvider(
      this.networkId,
    );
  }

  // Methods not related to a single account, but implementation.

  async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    throw new NotImplemented();
  }

  abstract createClientFromURL(url: string): BaseClient;

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
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx>;

  // buildEncodedTxFromNftTransfer
  // buildEncodedTxFromSwap

  // TODO return { UnsignedTx, IEncodedTx } , IEncodedTx may be modified
  abstract buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTx,
  ): Promise<UnsignedTx>;

  abstract fetchFeeInfo(encodedTx: IEncodedTx): Promise<IFeeInfo>;

  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ) {
    return this.keyring.signTransaction(unsignedTx, options);
  }

  async signAndSendTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<ISignedTx> {
    const signedTx = await this.signTransaction(unsignedTx, options);
    return this.broadcastTransaction(signedTx.rawTx, options);
  }

  async broadcastTransaction(
    rawTx: string,
    options: ISignCredentialOptions,
  ): Promise<ISignedTx> {
    debugLogger.engine('broadcastTransaction START:', { rawTx });
    // TODO RPC Error format return: EIP-1474 EIP-1193
    const txid = await this.engine.providerManager.broadcastTransaction(
      this.networkId,
      rawTx,
    );
    debugLogger.engine('broadcastTransaction END:', { txid, rawTx });
    return {
      rawTx,
      txid,
    };
  }

  async getTokenAllowance(
    tokenAddress: string,
    spenderAddress: string,
  ): Promise<BigNumber> {
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

  async fixDecodedTx(decodedTx: IDecodedTx): Promise<IDecodedTx> {
    decodedTx.createdAt = decodedTx.createdAt ?? Date.now();

    // TODO fix tx action direction both at SendConfirm
    const accountAddress = decodedTx.owner;
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < decodedTx.actions.length; i++) {
      const action = decodedTx.actions[i];
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
    }
    return Promise.resolve(decodedTx);
  }

  async fixHistoryTx(historyTx: IHistoryTx): Promise<IHistoryTx> {
    historyTx.decodedTx = await this.fixDecodedTx(historyTx.decodedTx);
    historyTx.createdAt = historyTx.decodedTx.createdAt;
    historyTx.status = historyTx.decodedTx.status;
    historyTx.isFinal = historyTx.decodedTx.isFinal;

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
    signedTx?: ISignedTx;
    isSigner?: boolean;
    isLocalCreated?: boolean;
  }): Promise<IHistoryTx> {
    const txid: string = decodedTx.txid || signedTx?.txid || '';
    if (!txid) {
      throw new Error('buildHistoryTx txid not found');
    }
    const address = await this.getAccountAddress();
    decodedTx.txid = decodedTx.txid || txid;
    decodedTx.owner = address;
    if (isSigner) {
      decodedTx.signer = address;
    }
    // TODO base.mergeDecodedTx with signedTx.rawTx
    // must include accountId here, so that two account wont share same tx history
    const historyId = `${this.networkId}_${txid}_${this.accountId}`;
    let historyTx: IHistoryTx = {
      id: historyId,

      networkId: this.networkId,
      accountId: this.accountId,

      isLocalCreated: Boolean(isLocalCreated),

      ...historyTxToMerge,

      encodedTx,
      decodedTx,
    };
    // TODO update encodedTx nonce from signedTx.rawTx
    historyTx = await this.fixHistoryTx(historyTx);
    return Promise.resolve(historyTx);
  }

  // TODO abstract method
  async fetchOnChainHistory(options: {
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
}
