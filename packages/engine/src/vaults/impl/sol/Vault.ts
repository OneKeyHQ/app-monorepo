/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-member-access */
import {
  CMT_PROGRAM,
  MintState,
  computeBudgetIx,
  findFreezeAuthorityPk,
  findMintStatePk,
  createInitAccountInstruction as ocpCreateInitAccountInstruction,
  createTransferInstruction as ocpCreateTransferInstruction,
} from '@magiceden-oss/open_creator_protocol';
import {
  Metadata,
  TokenRecord,
  TokenStandard,
  TokenState,
  createTransferInstruction as createTokenMetadataTransferInstruction,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TokenInstruction,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  decodeInstruction,
  decodeTransferCheckedInstruction,
  decodeTransferInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  ComputeBudgetProgram,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemInstruction,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import bs58 from 'bs58';
import { isArray, isEmpty, isNaN, isNil, omit } from 'lodash';

import { ed25519 } from '@onekeyhq/engine/src/secret/curves';
import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import type {
  FeePricePerUnit,
  PartialTokenInfo,
} from '@onekeyhq/engine/src/types/provider';
import type { Token } from '@onekeyhq/kit/src/store/typings';
import { getTimeDurationMs, wait } from '@onekeyhq/kit/src/utils/helper';
import { HISTORY_CONSTS } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import simpleDb from '../../../dbs/simple/simpleDb';
import {
  InvalidAddress,
  MinimumTransferBalanceRequiredError,
  MinimumTransferBalanceRequiredForSendingAssetError,
  NotImplemented,
  OneKeyError,
  OneKeyInternalError,
  PendingQueueTooLong,
} from '../../../errors';
import { getAccountNameInfoByImpl } from '../../../managers/impl';
import {
  createOutputActionFromNFTTransaction,
  getNFTTransactionHistory,
} from '../../../managers/nft';
import { extractResponseError } from '../../../proxy';
import { NFTAssetType } from '../../../types/nft';
import {
  IDecodedTxActionType,
  IDecodedTxStatus,
  IEncodedTxUpdateType,
} from '../../types';
import { VaultBase } from '../../VaultBase';

import {
  KeyringHardware,
  KeyringHd,
  KeyringImported,
  KeyringWatching,
} from './keyring';
import { ClientSol, PARAMS_ENCODINGS } from './sdk';
import settings from './settings';
import {
  MIN_PRIORITY_FEE,
  TOKEN_AUTH_RULES_ID,
  TOKEN_METADATA_PROGRAM_ID,
  masterEditionAddress,
  metadataAddress,
  tokenRecordAddress,
} from './utils';

import type { DBAccount, DBSimpleAccount } from '../../../types/account';
import type { AccountNameInfo } from '../../../types/network';
import type {
  Collection,
  NFTAsset,
  NFTAssetMeta,
  NFTListItems,
  NFTTransaction,
} from '../../../types/nft';
import type { TransactionStatus } from '../../../types/provider';
import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IApproveInfo,
  IBalanceDetails,
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
  IEncodedTxSol,
  INativeTxSol,
  ParsedAccountInfo,
} from './types';
import type {
  TransferInstructionAccounts,
  TransferInstructionArgs,
} from '@metaplex-foundation/mpl-token-metadata';
import type { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';
import type { AccountInfo, TransactionInstruction } from '@solana/web3.js';

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

  private getMinimumBalanceForRentExemption = memoizee(
    async (address): Promise<number> => {
      const client = await this.getClient();
      const accountInfo =
        (await client.getAccountInfo(address, PARAMS_ENCODINGS.BASE64)) ?? {};

      const accountData = (accountInfo as AccountInfo<[string, string]>)
        .data[0];

      const accountDataLength = Buffer.from(
        accountData,
        PARAMS_ENCODINGS.BASE64,
      ).length;
      const minimumBalanceForRentExemption =
        await client.getMinimumBalanceForRentExemption(accountDataLength);
      return minimumBalanceForRentExemption;
    },
    {
      promise: true,
      primitive: true,
      max: 50,
      maxAge: getTimeDurationMs({ minute: 3 }),
    },
  );

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
  override async getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    const client = await this.getClient();
    return client.getTransactionStatuses(txids);
  }

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

  override async getNextNonce(
    networkId: string,
    dbAccount: DBAccount,
  ): Promise<number> {
    // TODO move to Vault.getOnChainNextNonce
    const client = await this.getClient();
    const onChainNonce =
      (await client.getAddresses([dbAccount.address]))[0]?.nonce ?? 0;

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

  override async fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    const client = await this.getClient();
    return client.getTokenInfos(tokenAddresses);
  }

  override validateAddress(address: string): Promise<string> {
    try {
      const publicKey = new PublicKey(address);
      if (
        PublicKey.isOnCurve(address) ||
        PublicKey.isOnCurve(publicKey.encode())
      ) {
        return Promise.resolve(address);
      }
    } catch {
      // pass
    }
    return Promise.reject(new InvalidAddress());
  }

  override validateTokenAddress(address: string): Promise<string> {
    try {
      // eslint-disable-next-line no-new
      new PublicKey(address);
      return Promise.resolve(address);
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
            asset: info.asset as NFTAsset,
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
    if (!transferInfo.to) {
      throw new Error('Invalid transferInfo.to params');
    }

    return this.buildEncodedTxFromBatchTransfer({
      transferInfos: [transferInfo],
    });
  }

  override async buildEncodedTxFromBatchTransfer({
    transferInfos,
  }: {
    transferInfos: ITransferInfo[];
  }): Promise<IEncodedTx> {
    let retryTime = 0;
    let lastRpcErrorMessage = '';
    const maxRetryTimes = 5;
    const client = await this.getClient();
    const accountAddress = await this.getAccountAddress();
    const transferInfo = transferInfos[0];
    const { from, to: firstReceiver, isNFT } = transferInfo;

    const source = new PublicKey(from);
    const nativeTx = new Transaction();

    const doGetRecentBlockHash = async () => {
      try {
        return await client.getLatestBlockHash();
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
          `Solana getLatestBlockHash retry times exceeded: ${
            lastRpcErrorMessage || ''
          }`,
        );
      }
      const resp = await doGetRecentBlockHash();
      nativeTx.recentBlockhash = resp?.blockhash;
      nativeTx.lastValidBlockHeight = resp?.lastValidBlockHeight;
      await wait(1000);
    } while (!nativeTx.recentBlockhash);

    nativeTx.feePayer = source;

    // To make sure tx can be processed
    const prioritizationFee = await client.getRecentMaxPrioritizationFees([
      accountAddress,
    ]);

    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: Math.max(MIN_PRIORITY_FEE, prioritizationFee),
    });

    nativeTx.add(addPriorityFee);

    for (let i = 0; i < transferInfos.length; i += 1) {
      const {
        token: tokenAddress,
        amount,
        to,
        tokenSendAddress,
      } = transferInfos[i];
      const destination = new PublicKey(to || firstReceiver);

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
        // ata - associated token account
        const mint = new PublicKey(tokenAddress);
        let destinationAta = destination;

        const sourceAta = tokenSendAddress
          ? new PublicKey(tokenSendAddress)
          : await this.getAssociatedTokenAddress({
              mint,
              owner: source,
              isNFT,
            });

        if (PublicKey.isOnCurve(destination.toString())) {
          // system account, get token receiver address
          destinationAta = await this.getAssociatedTokenAddress({
            mint,
            owner: destination,
            isNFT,
          });
        }

        const destinationAtaInfo = await client.getAccountInfo(
          destinationAta.toString(),
        );

        if (isNFT) {
          const { isProgrammableNFT, metadata } =
            await this.checkIsProgrammableNFT(mint);
          if (isProgrammableNFT) {
            nativeTx.add(
              ...(await this.buildProgrammableNFTInstructions({
                mint,
                source,
                sourceAta,
                destination,
                destinationAta,
                destinationAtaInfo,
                amount,
                metadata: metadata as Metadata,
              })),
            );
          } else {
            const ocpMintState = await this.checkIsOpenCreatorProtocol(mint);
            if (ocpMintState) {
              nativeTx.add(
                ...this.buildOpenCreatorProtocolInstructions({
                  mint,
                  source,
                  sourceAta,
                  destination,
                  destinationAta,
                  destinationAtaInfo,
                  mintState: ocpMintState,
                }),
              );
            } else {
              nativeTx.add(
                ...this.buildTransferTokenInstructions({
                  mint,
                  source,
                  sourceAta,
                  destination,
                  destinationAta,
                  destinationAtaInfo,
                  token,
                  amount,
                }),
              );
            }
          }
        } else {
          nativeTx.add(
            ...this.buildTransferTokenInstructions({
              mint,
              source,
              sourceAta,
              destination,
              destinationAta,
              destinationAtaInfo,
              token,
              amount,
            }),
          );
        }
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

  private async buildProgrammableNFTInstructions({
    mint,
    source,
    sourceAta,
    destination,
    destinationAta,
    destinationAtaInfo,
    amount,
    metadata,
  }: {
    mint: PublicKey;
    source: PublicKey;
    sourceAta: PublicKey;
    destination: PublicKey;
    destinationAta: PublicKey;
    destinationAtaInfo: AccountInfo<[string, string]> | null;
    amount: string;
    metadata: Metadata;
  }) {
    const client = await this.getClient();
    const instructions: TransactionInstruction[] = [];
    const ownerTokenRecord = tokenRecordAddress(mint, sourceAta);
    const ownerTokenRecordInfo = await client.getAccountInfo(
      ownerTokenRecord.toString(),
    );

    if (ownerTokenRecordInfo) {
      // need to check whether the token is lock or listed
      const tokenRecord = TokenRecord.fromAccountInfo({
        ...ownerTokenRecordInfo,
        data: Buffer.from(ownerTokenRecordInfo.data[0], 'base64'),
      })[0];

      if (tokenRecord.state === TokenState.Locked) {
        throw new Error('token account is locked');
      } else if (tokenRecord.state === TokenState.Listed) {
        throw new Error('token is listed');
      }

      let authorizationRules: PublicKey | undefined;

      if (metadata.programmableConfig) {
        authorizationRules = metadata.programmableConfig.ruleSet ?? undefined;
      }

      const transferAccounts: TransferInstructionAccounts = {
        authority: source,
        tokenOwner: source,
        token: sourceAta,
        metadata: metadataAddress(mint),
        mint,
        edition: masterEditionAddress(mint),
        destinationOwner: destination,
        destination: destinationAta,
        payer: source,
        splTokenProgram: TOKEN_PROGRAM_ID,
        splAtaProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
        authorizationRules,
        authorizationRulesProgram: TOKEN_AUTH_RULES_ID,
        ownerTokenRecord,
        destinationTokenRecord: tokenRecordAddress(mint, destinationAta),
      };

      const transferArgs: TransferInstructionArgs = {
        transferArgs: {
          __kind: 'V1',
          amount: Number(amount),
          authorizationData: null,
        },
      };

      instructions.push(
        createTokenMetadataTransferInstruction(transferAccounts, transferArgs),
      );
    }

    return instructions;
  }

  private buildOpenCreatorProtocolInstructions({
    mint,
    source,
    sourceAta,
    destination,
    destinationAta,
    destinationAtaInfo,
    mintState,
  }: {
    mint: PublicKey;
    source: PublicKey;
    sourceAta: PublicKey;
    destination: PublicKey;
    destinationAta: PublicKey;
    destinationAtaInfo: AccountInfo<[string, string]> | null;
    mintState: MintState;
  }) {
    const inscriptions: TransactionInstruction[] = [];

    inscriptions.push(computeBudgetIx);

    if (!destinationAtaInfo) {
      inscriptions.push(
        ocpCreateInitAccountInstruction({
          policy: mintState.policy,
          freezeAuthority: findFreezeAuthorityPk(mintState.policy),
          mint,
          metadata: metadataAddress(mint),
          mintState: findMintStatePk(mint),
          from: destination,
          fromAccount: destinationAta,
          cmtProgram: CMT_PROGRAM,
          instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
          payer: source,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        }),
      );
    }

    inscriptions.push(
      ocpCreateTransferInstruction({
        policy: mintState.policy,
        freezeAuthority: findFreezeAuthorityPk(mintState.policy),
        mint,
        metadata: metadataAddress(mint),
        mintState: findMintStatePk(mint),
        from: source,
        fromAccount: sourceAta,
        cmtProgram: CMT_PROGRAM,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
        to: destination,
        toAccount: destinationAta,
      }),
    );

    return inscriptions;
  }

  private buildTransferTokenInstructions({
    mint,
    source,
    sourceAta,
    destination,
    destinationAta,
    destinationAtaInfo,
    token,
    amount,
  }: {
    mint: PublicKey;
    source: PublicKey;
    sourceAta: PublicKey;
    destination: PublicKey;
    destinationAta: PublicKey;
    destinationAtaInfo: AccountInfo<[string, string]> | null;
    token: Token;
    amount: string;
  }): TransactionInstruction[] {
    const instructions: TransactionInstruction[] = [];
    if (destinationAtaInfo === null) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          source,
          destinationAta,
          destination,
          mint,
        ),
      );
    }

    instructions.push(
      createTransferCheckedInstruction(
        sourceAta,
        mint,
        destinationAta,
        source,
        BigInt(new BigNumber(amount).shiftedBy(token.decimals).toFixed()),
        token.decimals,
      ),
    );

    return instructions;
  }

  private async checkIsProgrammableNFT(mint: PublicKey) {
    try {
      const client = await this.getClient();
      const metaAddress = metadataAddress(mint);
      const mintAccountInfo = await client.getAccountInfo(
        metaAddress.toString(),
      );

      if (mintAccountInfo) {
        const metadata = Metadata.fromAccountInfo({
          ...mintAccountInfo,
          data: Buffer.from(mintAccountInfo.data[0], 'base64'),
        })[0];

        return {
          metadata,
          isProgrammableNFT:
            metadata.tokenStandard === TokenStandard.ProgrammableNonFungible ||
            metadata.tokenStandard ===
              TokenStandard.ProgrammableNonFungibleEdition,
        };
      }
      return {
        isProgrammableNFT: false,
      };
    } catch (error) {
      console.log(error);
      return {
        isProgrammableNFT: false,
      };
    }
  }

  private async checkIsOpenCreatorProtocol(mint: PublicKey) {
    const client = await this.getClient();
    const mintStatePk = findMintStatePk(mint);
    const mintAccountInfo = await client.getAccountInfo(mintStatePk.toString());

    return mintAccountInfo !== null
      ? MintState.fromAccountInfo({
          ...mintAccountInfo,
          data: Buffer.from(mintAccountInfo.data[0], 'base64'),
        })[0]
      : null;
  }

  private async getAssociatedTokenAddress({
    mint,
    owner,
    isNFT,
  }: {
    mint: PublicKey;
    owner: PublicKey;
    isNFT?: boolean;
  }) {
    if (isNFT) {
      const client = await this.getClient();
      const tokenAccounts = await client.getTokenAccountsByOwner({
        address: owner.toString(),
      });

      const account = tokenAccounts?.find(
        (item) => item.account.data.parsed.info.mint === mint.toString(),
      );

      if (account) {
        return new PublicKey(account.pubkey);
      }
    }

    return Promise.resolve(getAssociatedTokenAddressSync(mint, owner));
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
    const client = await this.getClient();
    const network = await this.getNetwork();

    const doBroadcast = async () => {
      try {
        const options = isNodeBehind
          ? {
              // https://docs.solana.com/developing/clients/jsonrpc-api#sendtransaction
              //     commitment: 'confirmed',
              preflightCommitment: 'confirmed',
            }
          : {};
        debugLogger.engine.info('broadcastTransaction START:', {
          rawTx: signedTx.rawTx,
        });
        const txid = await client.broadcastTransaction(
          signedTx.rawTx,
          options || {},
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
      } catch (error) {
        debugLogger.engine.error('broadcastTransaction error:', error);
        // @ts-ignore
        const rpcErrorData = (error?.data ?? error?.response?.error) as
          | {
              code: number;
              message: string;
              data: any;
            }
          | undefined;
        if (error && rpcErrorData) {
          // https://docs.solana.com/developing/intro/rent
          if (
            rpcErrorData.code === -32002 &&
            rpcErrorData.message.endsWith('insufficient funds for rent')
          ) {
            isNodeBehind = false;
            throw new MinimumTransferBalanceRequiredError(
              '0.00089088',
              network.symbol,
            );
          }

          // sending some NFT has minimum balance requirements
          if (
            rpcErrorData.code === -32002 &&
            rpcErrorData.message.startsWith('Transaction simulation failed')
          ) {
            const logs = (rpcErrorData.data?.logs ?? []) as string[];
            for (const log of logs) {
              const match = log.match(
                /Transfer: insufficient lamports \d+, need (\d+)/,
              );

              const minimumBalance = Number(match?.[1]);

              if (!isNaN(minimumBalance)) {
                isNodeBehind = false;
                throw new MinimumTransferBalanceRequiredForSendingAssetError(
                  'NFT',
                  new BigNumber(minimumBalance)
                    .shiftedBy(-network.decimals)
                    .toFixed(),
                  network.symbol,
                );
              }
            }
          }

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

  override async getFrozenBalance(): Promise<number | Record<string, number>> {
    const address = await this.getAccountAddress();
    const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);
    try {
      const minimumBalance = await this.getMinimumBalanceForRentExemption(
        address,
      );

      return {
        'main': new BigNumber(minimumBalance ?? 0)
          .shiftedBy(-decimals)
          .toNumber(),
      };
    } catch {
      return 0;
    }
  }

  override async fetchBalanceDetails(): Promise<IBalanceDetails | undefined> {
    const { decimals } = await this.engine.getNativeTokenInfo(this.networkId);
    const address = await this.getAccountAddress();
    const [[nativeTokenBalance], rent] = await Promise.all([
      this.getBalances([{ address }]),
      this.getFrozenBalance(),
    ]);

    const rentBalance = new BigNumber((rent as { main: number }).main ?? '0');
    const totalBalance = new BigNumber(nativeTokenBalance ?? '0').shiftedBy(
      -decimals,
    );

    const availableBalance = totalBalance.minus(rentBalance);
    return {
      total: totalBalance.toFixed(),
      available: availableBalance.isGreaterThan(0)
        ? availableBalance.toFixed()
        : '0',
      unavailable: rentBalance.toFixed(),
    };
  }

  override async getFeePricePerUnit(): Promise<FeePricePerUnit> {
    const client = await this.getClient();
    return client.getFeePricePerUnit();
  }

  override async fetchFeeInfo(encodedTx: IEncodedTxSol): Promise<IFeeInfo> {
    const client = await this.getClient();
    const nativeTx = await this.helper.parseToNativeTx(encodedTx);
    const isVersionedTransaction = nativeTx instanceof VersionedTransaction;
    let message = '';
    if (isVersionedTransaction) {
      message = Buffer.from(nativeTx.message.serialize()).toString('base64');
    } else {
      message = (nativeTx as Transaction)
        .compileMessage()
        .serialize()
        .toString('base64');
    }
    const [network, feePerSig] = await Promise.all([
      this.getNetwork(),
      client.getFeesForMessage(message),
    ]);

    const prices = [
      new BigNumber(feePerSig).shiftedBy(-network.feeDecimals).toFixed(),
    ];

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

      const nftTxs = nftMap[txid] as NFTTransaction[];

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
    const { blockhash, lastValidBlockHeight } =
      await client.getLatestBlockHash();

    nativeTx.recentBlockhash = blockhash;
    nativeTx.lastValidBlockHeight = lastValidBlockHeight;

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

  override async getUserNFTAssets({
    serviceData,
  }: {
    serviceData: NFTListItems;
  }): Promise<NFTAssetMeta | undefined> {
    return Promise.resolve({
      type: NFTAssetType.SOL,
      data: serviceData as Collection[],
    });
  }
}
