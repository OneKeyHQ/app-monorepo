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
import { Account, DBAccount } from '../types/account';
import { HistoryEntry, HistoryEntryStatus } from '../types/history';
import { WalletType } from '../types/wallet';

import {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdateType,
  IFeeInfo,
  IFeeInfoUnit,
  ITransferInfo,
  IUserInputGuessingResult,
} from './types';
import { VaultContext } from './VaultContext';

import type { KeyringBase, KeyringBaseMock } from './keyring/KeyringBase';
import type {
  IPrepareHardwareAccountsParams,
  IPrepareSoftwareAccountsParams,
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

  abstract guessUserCreateInput(
    input: string,
  ): Promise<IUserInputGuessingResult>;

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

  async validateTokenAddress(address: string): Promise<string> {
    const { normalizedAddress, isValid } =
      await this.engineProvider.verifyTokenAddress(address);
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidTokenAddress();
    }
    return Promise.resolve(normalizedAddress);
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

  abstract decodeTx(encodedTx: IEncodedTx, payload?: any): Promise<IDecodedTx>;

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

  // TODO move to keyring
  abstract getExportedCredential(password: string): Promise<string>;

  async updatePendingTxs(
    pendingTxs: Array<HistoryEntry>,
  ): Promise<Record<string, HistoryEntryStatus>> {
    throw new NotImplemented();
  }
}
