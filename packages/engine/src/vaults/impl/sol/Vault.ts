/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-member-access */
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TokenInstruction,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  decodeInstruction,
  decodeTransferCheckedInstruction,
  decodeTransferInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import {
  AccountMeta,
  PublicKey,
  SystemInstruction,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import bs58 from 'bs58';
import { isArray, isEmpty, omit } from 'lodash';
import memoizee from 'memoizee';

import { ed25519 } from '@onekeyhq/engine/src/secret/curves';
import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type { PartialTokenInfo } from '@onekeyhq/engine/src/types/provider';
import { getTimeDurationMs, wait } from '@onekeyhq/kit/src/utils/helper';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import {
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from '../../../errors';
import { getAccountNameInfoByImpl } from '../../../managers/impl';
import {
  createOutputActionFromNFTTransaction,
  getNFTTransactionHistory,
} from '../../../managers/nft';
import { extractResponseError } from '../../../proxy';
import {
  IDecodedTxActionType,
  IDecodedTxStatus,
  IEncodedTxUpdateType,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import { ClientSol } from './ClientSol';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { DBSimpleAccount } from '../../../types/account';
import type { AccountNameInfo } from '../../../types/network';
import type { NFTTransaction } from '../../../types/nft';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  INFTInfo,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type {
  AssociatedTokenInfo,
  INativeTxSol,
  ParsedAccountInfo,
} from './types';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  getApiExplorerCache = memoizee((baseURL) => axios.create({ baseURL }), {
    promise: true,
    max: 1,
    maxAge: getTimeDurationMs({ minute: 3 }),
  });

  // client: axios
  getApiExplorer() {
    const baseURL = 'https://api.solscan.io/';
    return this.getApiExplorerCache(baseURL);
  }

  private async getClient(): Promise<ClientSol> {
    const rpcURL = await this.getRpcUrl();
    return this.createClientFromURL(rpcURL);
  }

  private getAssociatedAccountInfo = memoizee(
    async (ataAddress): Promise<AssociatedTokenInfo> => {
      const client = await this.getClient();
      const ataInfo = (await client.getAccountInfo(ataAddress)) ?? {};
      const { mint, owner } = (ataInfo as ParsedAccountInfo).data.parsed.info;
      return { mint, owner };
    },
    {
      promise: true,
      primitive: true,
      max: 50,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  private async decodeNativeTxActions(nativeTx: INativeTxSol) {
    const ret: Array<IDecodedTxAction> = [];

    const createdAta: Record<string, AssociatedTokenInfo> = {};

    // @ts-ignore
    if (!nativeTx.instructions) {
      return [{ type: IDecodedTxActionType.UNKNOWN }];
    }

    for (const instruction of (nativeTx as Transaction).instructions) {
      // TODO: only support system transfer & token transfer now
      if (
        instruction.programId.toString() === SystemProgram.programId.toString()
      ) {
        try {
          const instructionType =
            SystemInstruction.decodeInstructionType(instruction);
          if (instructionType === 'Transfer') {
            const nativeToken = await this.engine.getNativeTokenInfo(
              this.networkId,
            );
            const { fromPubkey, toPubkey, lamports } =
              SystemInstruction.decodeTransfer(instruction);
            const nativeAmount = new BigNumber(lamports.toString());
            ret.push({
              type: IDecodedTxActionType.NATIVE_TRANSFER,
              nativeTransfer: {
                tokenInfo: nativeToken,
                from: fromPubkey.toString(),
                to: toPubkey.toString(),
                amount: nativeAmount.shiftedBy(-nativeToken.decimals).toFixed(),
                amountValue: nativeAmount.toFixed(),
                extraInfo: null,
              },
            });
          }
        } catch {
          // pass
        }
      } else if (
        instruction.programId.toString() ===
          ASSOCIATED_TOKEN_PROGRAM_ID.toString() &&
        instruction.data.length === 0 &&
        instruction.keys.length === 7 &&
        instruction.keys[4].pubkey.toString() ===
          SystemProgram.programId.toString() &&
        instruction.keys[5].pubkey.toString() === TOKEN_PROGRAM_ID.toString()
      ) {
        // Associated token account is newly created.
        const [, associatedToken, owner, mint] = instruction.keys;
        if (associatedToken && owner && mint) {
          createdAta[associatedToken.pubkey.toString()] = {
            owner: owner.pubkey.toString(),
            mint: mint.pubkey.toString(),
          };
        }
      } else if (
        instruction.programId.toString() === TOKEN_PROGRAM_ID.toString()
      ) {
        try {
          const {
            data: { instruction: instructionType },
          } = decodeInstruction(instruction);
          let nativeAmount;
          let fromAddress;
          let tokenAddress;
          let ataAddress;

          if (instructionType === TokenInstruction.TransferChecked) {
            const {
              data: { amount },
              keys: { owner, mint, destination },
            } = decodeTransferCheckedInstruction(instruction);

            nativeAmount = new BigNumber(amount.toString());
            fromAddress = owner.pubkey.toString();
            tokenAddress = mint.pubkey.toString();
            ataAddress = destination.pubkey.toString();
          } else if (instructionType === TokenInstruction.Transfer) {
            const {
              data: { amount },
              keys: { owner, destination },
            } = decodeTransferInstruction(instruction);

            nativeAmount = new BigNumber(amount.toString());
            fromAddress = owner.pubkey.toString();
            ataAddress = destination.pubkey.toString();
          }

          if (nativeAmount && fromAddress && ataAddress) {
            const ataAccountInfo =
              createdAta[ataAddress] ||
              (await this.getAssociatedAccountInfo(ataAddress));
            const { mint, owner: toAddress } = ataAccountInfo;

            tokenAddress = tokenAddress || mint;
            const tokenInfo = await this.engine.ensureTokenInDB(
              this.networkId,
              tokenAddress,
            );
            if (tokenInfo) {
              ret.push({
                type: IDecodedTxActionType.TOKEN_TRANSFER,
                tokenTransfer: {
                  tokenInfo,
                  from: fromAddress,
                  to: toAddress ?? ataAddress,
                  amount: nativeAmount.shiftedBy(-tokenInfo.decimals).toFixed(),
                  amountValue: nativeAmount.toFixed(),
                  extraInfo: null,
                },
              });
            }
          }
        } catch {
          // pass
        }
      }
    }
    if (ret.length === 0) {
      ret.push({ type: IDecodedTxActionType.UNKNOWN });
    }

    return ret;
  }

  // Chain only methods

  override async proxyJsonRPCCall<T>(request: IJsonRpcRequest): Promise<T> {
    const client = await this.getClient();
    try {
      return await client.rpc.call(
        request.method,
        request.params as Record<string, any> | Array<any>,
      );
    } catch (e) {
      throw extractResponseError(e);
    }
  }

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ): Promise<(BigNumber | undefined)[]> {
    const requestsNew = requests.map(({ address, tokenAddress }) => ({
      address,
      coin: { ...(typeof tokenAddress === 'string' ? { tokenAddress } : {}) },
    }));
    const client = await this.getClient();
    return client.getBalances(requestsNew);
  }

  override createClientFromURL = memoizee(
    (rpcURL: string) => new ClientSol(rpcURL),
    {
      max: 1,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

  override fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    return this.engine.providerManager.getTokenInfos(
      this.networkId,
      tokenAddresses,
    );
  }

  override validateAddress(address: string): Promise<string> {
    try {
      if (PublicKey.isOnCurve(address)) {
        return Promise.resolve(address);
      }
    } catch {
      // pass
    }
    return Promise.reject(new InvalidAddress());
  }

  override validateImportedCredential(input: string): Promise<boolean> {
    if (this.settings.importedAccountEnabled) {
      try {
        const secret = bs58.decode(input);
        if (secret.length === 64) {
          const [priv, pub] = [secret.slice(0, 32), secret.slice(32)];
          return Promise.resolve(
            ed25519.publicFromPrivate(priv).toString('hex') ===
              pub.toString('hex'),
          );
        }
      } catch {
        // pass
      }
    }
    return Promise.resolve(false);
  }

  override async validateWatchingCredential(input: string): Promise<boolean> {
    let ret = false;
    if (this.settings.watchingAccountEnabled) {
      try {
        await this.validateAddress(input);
        ret = true;
      } catch {
        // pass
      }
    }
    return Promise.resolve(ret);
  }

  // Account related methods

  override attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTx;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTx> {
    return Promise.resolve(params.encodedTx);
  }

  override async decodeTx(
    encodedTx: IEncodedTx,
    payload?: any,
  ): Promise<IDecodedTx> {
    const nativeTx: INativeTxSol = await this.helper.parseToNativeTx(encodedTx);
    let actions: IDecodedTxAction[] = await this.decodeNativeTxActions(
      nativeTx,
    );

    const isVersionedTransaction = nativeTx instanceof VersionedTransaction;

    let signature = isVersionedTransaction
      ? nativeTx.signatures[0]
      : nativeTx.signature;

    if (signature?.every((value) => value === 0)) {
      signature = null;
    }
    if (payload?.type === 'InternalSwap' && payload?.swapInfo) {
      actions = [
        {
          type: IDecodedTxActionType.INTERNAL_SWAP,
          internalSwap: {
            ...payload.swapInfo,
            extraInfo: null,
          },
        },
      ];
    }
    if (
      payload?.type === 'Transfer' &&
      (payload?.nftInfo || payload?.nftInfos)
    ) {
      const infos: INFTInfo[] = payload.nftInfos
        ? payload.nftInfos
        : [payload.nftInfo];
      actions = [];
      infos.map((info) =>
        actions.push({
          type: IDecodedTxActionType.NFT_TRANSFER,
          nftTransfer: {
            asset: info.asset,
            amount: info.amount,
            send: info.from,
            receive: info.to,
            extraInfo: null,
          },
        }),
      );
    }

    const owner = await this.getAccountAddress();
    const decodedTx: IDecodedTx = {
      txid: signature ? bs58.encode(signature) : '',
      owner,
      signer: (nativeTx as Transaction).feePayer?.toString() || owner,
      nonce: 0,
      actions,
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,

      extraInfo: null,
      encodedTx,
    };

    return decodedTx;
  }

  override decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTx> {
    const { from, to, amount, token: tokenAddress, sendAddress } = transferInfo;
    const network = await this.getNetwork();
    const client = await this.getClient();
    const token = await this.engine.ensureTokenInDB(
      this.networkId,
      tokenAddress ?? '',
    );
    if (!token) {
      throw new OneKeyInternalError(
        `Token not found: ${tokenAddress || 'main'}`,
      );
    }

    const feePayer = new PublicKey(from);
    const receiver = new PublicKey(to);
    const nativeTx = new Transaction();
    [, nativeTx.recentBlockhash] = await client.getFees();
    nativeTx.feePayer = feePayer;

    if (tokenAddress) {
      const mint = new PublicKey(tokenAddress);
      let associatedTokenAddress = receiver;
      if (PublicKey.isOnCurve(receiver.toString())) {
        // system account, get token receiver address
        associatedTokenAddress = await getAssociatedTokenAddress(
          mint,
          receiver,
        );
      }
      const associatedAccountInfo = await client.getAccountInfo(
        associatedTokenAddress.toString(),
      );
      if (associatedAccountInfo === null) {
        nativeTx.add(
          createAssociatedTokenAccountInstruction(
            feePayer,
            associatedTokenAddress,
            receiver,
            mint,
          ),
        );
      }

      const source = sendAddress
        ? new PublicKey(sendAddress)
        : await getAssociatedTokenAddress(mint, feePayer);
      nativeTx.add(
        createTransferCheckedInstruction(
          source,
          mint,
          associatedTokenAddress,
          feePayer,
          BigInt(new BigNumber(amount).shiftedBy(token.decimals).toFixed()),
          token.decimals,
        ),
      );
    } else {
      nativeTx.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(from),
          toPubkey: new PublicKey(to),
          lamports: BigInt(
            new BigNumber(amount).shiftedBy(token.decimals).toFixed(),
          ),
        }),
      );
    }

    return bs58.encode(nativeTx.serialize({ requireAllSignatures: false }));
  }

  override async buildEncodedTxFromBatchTransfer(
    transferInfos: ITransferInfo[],
  ): Promise<IEncodedTx> {
    let retryTime = 0;
    let lastRpcErrorMessage = '';
    const maxRetryTimes = 5;
    const client = await this.getClient();
    const transferInfo = transferInfos[0];
    const { from, to: firstReceiver, isNFT } = transferInfo;

    const feePayer = new PublicKey(from);
    const nativeTx = new Transaction();

    const doGetFee = async () => {
      try {
        const [, recentBlockhash] = await client.getFees();
        return recentBlockhash;
      } catch (error: any) {
        const rpcErrorData = error?.data as
          | {
              code: number;
              message: string;
              data: any;
            }
          | undefined;
        if (error && rpcErrorData) {
          lastRpcErrorMessage = rpcErrorData.message;
        }
      }
    };

    do {
      retryTime += 1;
      if (retryTime > maxRetryTimes) {
        throw new Error(
          `Solana getFees retry times exceeded: ${lastRpcErrorMessage || ''}`,
        );
      }
      const recentBlockhash = await doGetFee();
      nativeTx.recentBlockhash = recentBlockhash;
      await wait(1000);
    } while (!nativeTx.recentBlockhash);

    nativeTx.feePayer = feePayer;

    for (let i = 0; i < transferInfos.length; i += 1) {
      const { token: tokenAddress, amount, to, sendAddress } = transferInfos[i];
      const receiver = new PublicKey(to || firstReceiver);

      const token = await this.engine.ensureTokenInDB(
        this.networkId,
        tokenAddress ?? '',
      );
      if (!token) {
        throw new OneKeyInternalError(
          `Token not found: ${tokenAddress || 'main'}`,
        );
      }
      if (tokenAddress) {
        const mint = new PublicKey(tokenAddress);
        let associatedTokenAddress = receiver;
        if (PublicKey.isOnCurve(receiver.toString())) {
          // system account, get token receiver address
          associatedTokenAddress = await getAssociatedTokenAddress(
            mint,
            receiver,
          );
        }
        const associatedAccountInfo = await client.getAccountInfo(
          associatedTokenAddress.toString(),
        );
        if (associatedAccountInfo === null) {
          nativeTx.add(
            createAssociatedTokenAccountInstruction(
              feePayer,
              associatedTokenAddress,
              receiver,
              mint,
            ),
          );
        }

        const source = sendAddress
          ? new PublicKey(sendAddress)
          : await getAssociatedTokenAddress(mint, feePayer);
        nativeTx.add(
          createTransferCheckedInstruction(
            source,
            mint,
            associatedTokenAddress,
            feePayer,
            BigInt(new BigNumber(amount).shiftedBy(token.decimals).toFixed()),
            token.decimals,
          ),
        );
      } else {
        nativeTx.add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(from),
            toPubkey: new PublicKey(to),
            lamports: BigInt(
              new BigNumber(amount).shiftedBy(token.decimals).toFixed(),
            ),
          }),
        );
      }
    }

    return bs58.encode(nativeTx.serialize({ requireAllSignatures: false }));
  }

  override buildEncodedTxFromApprove(
    approveInfo: IApproveInfo,
  ): Promise<IEncodedTx> {
    // TODO
    throw new NotImplemented();
  }

  override updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
    // TODO
    throw new NotImplemented();
  }

  override async updateEncodedTx(
    encodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    if (options.type === IEncodedTxUpdateType.advancedSettings) {
      return Promise.resolve(encodedTx);
    }

    const nativeTx = (await this.helper.parseToNativeTx(
      encodedTx,
    )) as Transaction;
    const [instruction] = nativeTx.instructions;
    // max native token transfer update
    if (
      options.type === 'transfer' &&
      nativeTx.instructions.length === 1 &&
      instruction.programId.toString() === SystemProgram.programId.toString()
    ) {
      const instructionType =
        SystemInstruction.decodeInstructionType(instruction);
      if (instructionType === 'Transfer') {
        const { fromPubkey, toPubkey } =
          SystemInstruction.decodeTransfer(instruction);
        const nativeToken = await this.engine.getNativeTokenInfo(
          this.networkId,
        );
        const { amount } = payload as IEncodedTxUpdatePayloadTransfer;
        nativeTx.instructions = [
          SystemProgram.transfer({
            fromPubkey,
            toPubkey,
            lamports: BigInt(
              new BigNumber(amount).shiftedBy(nativeToken.decimals).toFixed(),
            ),
          }),
        ];
        return bs58.encode(nativeTx.serialize({ requireAllSignatures: false }));
      }
    }
    return Promise.resolve(encodedTx);
  }

  override async broadcastTransaction(signedTx: ISignedTxPro) {
    let isNodeBehind = false;
    const maxRetryTimes = 8;
    let retryTime = 0;
    let lastRpcErrorMessage = '';

    const doBroadcast = async () => {
      try {
        const options = isNodeBehind
          ? {
              // https://docs.solana.com/developing/clients/jsonrpc-api#sendtransaction
              //     commitment: 'confirmed',
              preflightCommitment: 'confirmed',
            }
          : {};
        const result = await super.broadcastTransaction(
          signedTx,
          options || {},
        );
        return result;
      } catch (error) {
        // @ts-ignore
        const rpcErrorData = error?.data as
          | {
              code: number;
              message: string;
              data: any;
            }
          | undefined;
        if (error && rpcErrorData) {
          // https://marinade.finance/app/defi/
          // error.data
          //    {"code":-32005,"message":"Node is behind by 1018821 slots","data":{"numSlotsBehind":1018821}}
          //    {"code":-32002,"message":"Transaction simulation failed: Blockhash not found","data":{"accounts":null,"err":"BlockhashNotFound","logs":[],"unitsConsumed":0}}
          if (rpcErrorData.code === -32005 || rpcErrorData.code === -32002) {
            isNodeBehind = true;
            lastRpcErrorMessage = rpcErrorData.message;
            return;
          }
        }
        throw error;
      }
    };

    do {
      retryTime += 1;
      if (retryTime > maxRetryTimes) {
        isNodeBehind = false;
        throw new Error(
          `Solana broadcastTransaction retry times exceeded: ${
            lastRpcErrorMessage || ''
          }`,
        );
      }
      const result = await doBroadcast();
      if (result) {
        return result;
      }
      await wait(1000);
    } while (isNodeBehind);

    throw new Error('Solana broadcastTransaction retry failed');
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTx,
  ): Promise<IUnsignedTxPro> {
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const nativeTx = (await this.helper.parseToNativeTx(
      encodedTx,
    )) as Transaction;
    const client = await this.getClient();

    return {
      inputs: [],
      outputs: [],
      payload: {
        nativeTx,
        feePayer: new PublicKey(dbAccount.pub),
      },
      encodedTx,
    };
  }

  override async fetchFeeInfo(encodedTx: IEncodedTx): Promise<IFeeInfo> {
    const [network, { prices }, nativeTx] = await Promise.all([
      this.getNetwork(),
      this.engine.getGasInfo(this.networkId),
      this.helper.parseToNativeTx(encodedTx),
    ]);

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      // Solana fee is price * number of signatures
      limit: (nativeTx as Transaction).signatures.length.toString(),
      prices,
      defaultPresetIndex: '0',

      tx: null, // Must be null if network not support feeInTx
    };
  }

  override async getExportedCredential(password: string): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return bs58.encode(
        Buffer.concat([
          decrypt(password, encryptedPrivateKey),
          bs58.decode(dbAccount.pub),
        ]),
      );
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  mergeNFTTx({
    address,
    decodedTx,
    nftTxs,
  }: {
    address: string;
    decodedTx: IDecodedTx;
    nftTxs?: NFTTransaction[];
  }): IDecodedTx {
    if (nftTxs) {
      const nftActions = nftTxs
        .map((tx) =>
          createOutputActionFromNFTTransaction({
            transaction: tx,
            address,
          }),
        )
        .filter(Boolean);
      decodedTx.actions = nftActions;
    }
    return decodedTx;
  }

  async mergeDecodedTx({
    decodedTx,
    nftTxs,
  }: {
    decodedTx: IDecodedTx;
    nftTxs?: NFTTransaction[];
  }): Promise<IDecodedTx> {
    const address = await this.getAccountAddress();
    if (nftTxs && nftTxs.length > 0) {
      const decodedTxWithNFT = this.mergeNFTTx({ address, decodedTx, nftTxs });
      return Promise.resolve(decodedTxWithNFT);
    }
    return Promise.resolve(decodedTx);
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory = [], tokenIdOnNetwork } = options;
    if (tokenIdOnNetwork) {
      // No token support now.
      return Promise.resolve([]);
    }
    const network = await this.getNetwork();
    const ApiExplorer = this.getApiExplorer();
    const client = await this.getClient();
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);
    let transfers: Array<{
      signature?: string[] | string;
      txHash?: string;
      decimals?: number;
      change?: {
        decimals: number;
      };
    }> = [];

    if (network.isTestnet) {
      transfers = await client.rpc.call('getSignaturesForAddress', [
        dbAccount.address,
        { limit: 50 },
      ]);
    } else {
      // Get full on chain history (including NFT) by using solscan api
      // Does not support devnet
      const splTransfersRequest = ApiExplorer.get<{
        data: {
          tx: {
            transactions: {
              txHash: string;
              change: {
                decimals: number;
              };
            }[];
          };
        };
      }>('/account/soltransfer/txs', {
        params: {
          address: dbAccount.address,
          offset: 0,
          limit: 25,
        },
      });

      const solTransferRequest = ApiExplorer.get<{
        data: {
          tx: {
            transactions: { txHash: string; decimals?: number }[];
          };
        };
      }>('/account/token/txs', {
        params: {
          address: dbAccount.address,
          offset: 0,
          limit: 25,
        },
      });

      const [splResp, solResl] = await Promise.all([
        splTransfersRequest,
        solTransferRequest,
      ]);

      const splTransfers = splResp?.data?.data?.tx?.transactions || [];
      const solTransfers = solResl?.data?.data?.tx?.transactions || [];
      transfers = [...splTransfers, ...solTransfers];
    }

    const onChainTxs: Array<{
      blockTime: number;
      transaction: [IEncodedTx];
      meta: { fee: number; err: any | null };
    }> = await client.rpc.batchCall(
      transfers.map(({ signature, txHash }) => [
        'getTransaction',
        [
          txHash || (isArray(signature) ? signature[0] : signature),
          { encoding: 'base58', maxSupportedTransactionVersion: 0 },
        ],
      ]),
    );

    const nftMap = await getNFTTransactionHistory(
      dbAccount.address,
      this.networkId,
    );

    const promises = onChainTxs.map(async (tx, index) => {
      const transferItem = transfers[index];
      const txid =
        transferItem.txHash ||
        (isArray(transferItem.signature)
          ? transferItem.signature && transferItem.signature[0]
          : transferItem.signature) ||
        '';
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === txid,
      );
      let isFinal = true;
      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        // No need to update.
        return Promise.resolve(null);
      }

      const nftTxs = nftMap[txid];

      if (
        transferItem &&
        (transferItem.decimals === 0 || transferItem.change?.decimals === 0) &&
        isEmpty(nftTxs)
      ) {
        isFinal = false;
      }

      try {
        const {
          blockTime,
          transaction: [encodedTx],
          meta: { fee: feeValue, err },
        } = tx;
        const updatedAt = blockTime * 1000;
        let decodedTx: IDecodedTx = {
          // Only decode if this item is not created locally as we are not
          // able to fully decoded on chain transactions now.
          ...(historyTxToMerge?.decodedTx ?? (await this.decodeTx(encodedTx))),
          txid,
          totalFeeInNative: new BigNumber(feeValue)
            .shiftedBy(-decimals)
            .toFixed(),
          status: err ? IDecodedTxStatus.Failed : IDecodedTxStatus.Confirmed,
          updatedAt,
          createdAt: historyTxToMerge?.decodedTx.createdAt ?? updatedAt,
          isFinal,
        };
        decodedTx = await this.mergeDecodedTx({
          decodedTx,
          nftTxs,
        });

        return await this.buildHistoryTx({ decodedTx, historyTxToMerge });
      } catch (e) {
        debugLogger.common.error(e);
      }

      return Promise.resolve(null);
    });

    return (await Promise.all(promises)).filter(Boolean);
  }

  override async getPrivateKeyByCredential(credential: string) {
    let privateKey;
    const decodedPrivateKey = bs58.decode(credential);
    if (decodedPrivateKey.length === 64) {
      privateKey = decodedPrivateKey.slice(0, 32);
    }
    return Promise.resolve(privateKey);
  }

  async refreshRecentBlockBash(transaction: string): Promise<string> {
    const nativeTx: Transaction = await this.helper.parseToNativeTx(
      transaction,
    );
    const client = await this.getClient();
    [, nativeTx.recentBlockhash] = await client.getFees();

    return bs58.encode(nativeTx.serialize({ requireAllSignatures: false }));
  }

  override async getAccountNameInfoMap(): Promise<
    Record<string, AccountNameInfo>
  > {
    const isHwWallet = this.walletId.startsWith('hw');
    const network = await this.getNetwork();
    const accountNameInfo = getAccountNameInfoByImpl(network.impl);
    if (isHwWallet || !this.walletId) {
      return omit(accountNameInfo, 'ledgerLive');
    }
    return accountNameInfo;
  }

  override async canAutoCreateNextAccount(password: string): Promise<boolean> {
    return Promise.resolve(true);
  }
}
