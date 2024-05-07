/* eslint-disable spellcheck/spell-checker */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
import { wait } from '@onekeyfe/hd-core';
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
  AddressLookupTableAccount,
  ComputeBudgetInstruction,
  ComputeBudgetProgram,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemInstruction,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import bs58 from 'bs58';
import { add, isEmpty, isNil } from 'lodash';

import type {
  IEncodedTxSol,
  INativeTxSol,
} from '@onekeyhq/core/src/chains/sol/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import {
  EDecodedTxActionType,
  type IDecodedTx,
  type IDecodedTxAction,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import ClientSol from './sdkSol/ClientSol';
import {
  TOKEN_AUTH_RULES_ID,
  masterEditionAddress,
  metadataAddress,
  parseToNativeTx,
  tokenRecordAddress,
} from './utils';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';
import type {
  TransferInstructionAccounts,
  TransferInstructionArgs,
} from '@metaplex-foundation/mpl-token-metadata';
import type { AccountInfo, TransactionInstruction } from '@solana/web3.js';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.sol.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  _getClientCache = memoizee(
    async () =>
      new ClientSol({
        networkId: this.networkId,
        backgroundApi: this.backgroundApi,
      }),
    {
      maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
    },
  );

  async getClient() {
    return this._getClientCache();
  }

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId, externalAccountAddress } = params;

    const address = account.address || externalAccountAddress || '';

    const { normalizedAddress, displayAddress, isValid } =
      await this.validateAddress(address);
    return {
      networkId,
      normalizedAddress,
      displayAddress,
      address: displayAddress,
      baseAddress: normalizedAddress,
      isValid,
      allowEmptyAddress: false,
    };
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxSol> {
    const { transfersInfo } = params;

    if (transfersInfo && !isEmpty(transfersInfo)) {
      if (transfersInfo.length === 1) {
        return this._buildEncodedTxFromTransfer({
          transferInfo: transfersInfo[0],
        });
      }
      return this._buildEncodedTxFromBatchTransfer({ transfersInfo });
    }

    throw new OneKeyInternalError();
  }

  async _buildEncodedTxFromTransfer(params: { transferInfo: ITransferInfo }) {
    const { transferInfo } = params;

    return this._buildEncodedTxFromBatchTransfer({
      transfersInfo: [transferInfo],
    });
  }

  async _buildEncodedTxFromBatchTransfer(params: {
    transfersInfo: ITransferInfo[];
  }): Promise<IEncodedTxSol> {
    const { transfersInfo } = params;
    const transferInfo = transfersInfo[0];

    const { from, to: firstReceiver } = transferInfo;

    if (!transferInfo.to) {
      throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
    }
    const client = await this.getClient();
    const source = new PublicKey(from);
    const nativeTx = new Transaction();

    const { recentBlockhash, lastValidBlockHeight } =
      await this._getRecentBlockHash();

    nativeTx.recentBlockhash = recentBlockhash;
    nativeTx.lastValidBlockHeight = lastValidBlockHeight;

    nativeTx.feePayer = source;

    for (let i = 0; i < transfersInfo.length; i += 1) {
      const { amount, to, tokenInfo, nftInfo } = transfersInfo[i];

      if (!tokenInfo && !nftInfo) {
        throw new Error(
          'buildEncodedTx ERROR: transferInfo.tokenInfo and transferInfo.nftInfo are both missing',
        );
      }

      const isNativeTokenTransfer = !!tokenInfo?.isNative;

      const destination = new PublicKey(to || firstReceiver);
      if (isNativeTokenTransfer) {
        nativeTx.add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(from),
            toPubkey: new PublicKey(to),
            lamports: BigInt(
              new BigNumber(amount).shiftedBy(tokenInfo.decimals).toFixed(),
            ),
          }),
        );
      } else {
        // ata - associated token account
        const tokenAddress = tokenInfo?.address ?? nftInfo?.nftAddress ?? '';
        const tokenSendAddress = tokenInfo?.sendAddress;
        const mint = new PublicKey(tokenAddress);
        const isNFT = !!nftInfo;
        let destinationAta = destination;

        const sourceAta = tokenSendAddress
          ? new PublicKey(tokenSendAddress)
          : await this._getAssociatedTokenAddress({
              mint,
              owner: source,
              isNFT,
            });

        if (PublicKey.isOnCurve(destination.toString())) {
          // system account, get token receiver address
          destinationAta = await this._getAssociatedTokenAddress({
            mint,
            owner: destination,
            isNFT,
          });
        }

        const destinationAtaInfo = await client.getAccountInfo({
          address: destinationAta.toString(),
        });

        if (nftInfo) {
          const { isProgrammableNFT, metadata } =
            await this._checkIsProgrammableNFT(mint);
          if (isProgrammableNFT) {
            nativeTx.add(
              ...(await this._buildProgrammableNFTInstructions({
                mint,
                source,
                sourceAta,
                destination,
                destinationAta,
                amount,
                metadata: metadata as Metadata,
              })),
            );
          } else {
            const ocpMintState = await this._checkIsOpenCreatorProtocol(mint);
            if (ocpMintState) {
              nativeTx.add(
                ...this._buildOpenCreatorProtocolInstructions({
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
                ...this._buildTransferTokenInstructions({
                  mint,
                  source,
                  sourceAta,
                  destination,
                  destinationAta,
                  destinationAtaInfo,
                  tokenDecimals: 0,
                  amount,
                }),
              );
            }
          }
        } else if (tokenInfo) {
          nativeTx.add(
            ...this._buildTransferTokenInstructions({
              mint,
              source,
              sourceAta,
              destination,
              destinationAta,
              destinationAtaInfo,
              tokenDecimals: tokenInfo.decimals,
              amount,
            }),
          );
        }
      }
    }

    return bs58.encode(nativeTx.serialize({ requireAllSignatures: false }));
  }

  async _getRecentBlockHash() {
    let lastRpcErrorMessage = '';

    const client = await this.getClient();

    for (let i = 0; i < 5; i += 1) {
      try {
        const resp = await client.getLatestBlockHash();
        if (!isNil(resp.recentBlockhash) && !isNil(resp.lastValidBlockHeight)) {
          return resp;
        }
      } catch (e: any) {
        const rpcErrorData = e?.data as
          | {
              code: number;
              message: string;
              data: any;
            }
          | undefined;
        if (e && rpcErrorData) {
          lastRpcErrorMessage = rpcErrorData.message;
        }
      }
      await wait(1000);
    }

    throw new Error(
      `Solana getLatestBlockHash retry times exceeded: ${
        lastRpcErrorMessage || ''
      }`,
    );
  }

  async _getAssociatedTokenAddress({
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

  async _checkIsProgrammableNFT(mint: PublicKey) {
    try {
      const client = await this.getClient();
      const metaAddress = metadataAddress(mint);
      const mintAccountInfo = await client.getAccountInfo({
        address: metaAddress.toString(),
      });

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
      return {
        isProgrammableNFT: false,
      };
    }
  }

  async _buildProgrammableNFTInstructions({
    mint,
    source,
    sourceAta,
    destination,
    destinationAta,
    amount,
    metadata,
  }: {
    mint: PublicKey;
    source: PublicKey;
    sourceAta: PublicKey;
    destination: PublicKey;
    destinationAta: PublicKey;
    amount: string;
    metadata: Metadata;
  }) {
    const client = await this.getClient();
    const instructions: TransactionInstruction[] = [];
    const ownerTokenRecord = tokenRecordAddress(mint, sourceAta);
    const ownerTokenRecordInfo = await client.getAccountInfo({
      address: ownerTokenRecord.toString(),
    });

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

  async _checkIsOpenCreatorProtocol(mint: PublicKey) {
    const client = await this.getClient();
    const mintStatePk = findMintStatePk(mint);
    const mintAccountInfo = await client.getAccountInfo({
      address: mintStatePk.toString(),
    });

    return mintAccountInfo !== null
      ? MintState.fromAccountInfo({
          ...mintAccountInfo,
          data: Buffer.from(mintAccountInfo.data[0], 'base64'),
        })[0]
      : null;
  }

  _buildOpenCreatorProtocolInstructions({
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

  _buildTransferTokenInstructions({
    mint,
    source,
    sourceAta,
    destination,
    destinationAta,
    destinationAtaInfo,
    tokenDecimals,
    amount,
  }: {
    mint: PublicKey;
    source: PublicKey;
    sourceAta: PublicKey;
    destination: PublicKey;
    destinationAta: PublicKey;
    destinationAtaInfo: AccountInfo<[string, string]> | null;
    tokenDecimals: number;
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
        BigInt(new BigNumber(amount).shiftedBy(tokenDecimals).toFixed()),
        tokenDecimals,
      ),
    );

    return instructions;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxSol;
    const nativeTx = parseToNativeTx(encodedTx);
    let actions: IDecodedTxAction[] = await this._decodeNativeTxActions(
      nativeTx,
    );

    const isVersionedTransaction = nativeTx instanceof VersionedTransaction;

    let signature = isVersionedTransaction
      ? nativeTx.signatures[0]
      : nativeTx.signature;

    if (signature?.every((value) => value === 0)) {
      signature = null;
    }
  }

  async _decodeNativeTxActions(nativeTx: INativeTxSol) {
    const ret: Array<IDecodedTxAction> = [];

    const createdAta: Record<string, AssociatedTokenInfo> = {};

    // @ts-ignore
    if (!nativeTx.instructions) {
      return [{ type: EDecodedTxActionType.UNKNOWN }];
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
            const nativeToken =
              await this.backgroundApi.serviceToken.getNativeToken({
                networkId: this.networkId,
              });
            const { fromPubkey, toPubkey, lamports } =
              SystemInstruction.decodeTransfer(instruction);
            const nativeAmount = new BigNumber(lamports.toString());
            const transfer = {
              
            }
            ret.push({
              type: EDecodedTxActionType.NATIVE_TRANSFER,
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
      ret.push({ type: EDecodedTxActionType.UNKNOWN });
    }

    return ret;
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx as IEncodedTxEvm);
    }
    throw new OneKeyInternalError();
  }

  override updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    try {
      const publicKey = new PublicKey(address);
      if (
        PublicKey.isOnCurve(address) ||
        PublicKey.isOnCurve(publicKey.encode()) ||
        bs58.decode(address).length === 32
      ) {
        return Promise.resolve({
          isValid: true,
          normalizedAddress: address,
          displayAddress: address,
        });
      }
    } catch {
      // pass
    }

    return Promise.resolve({
      isValid: false,
      normalizedAddress: '',
      displayAddress: '',
    });
  }

  override validateXpub(): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = decodeSensitiveText({ encodedText: params.input });
    let privateKey;
    const decodedPrivateKey = bs58.decode(input);
    if (decodedPrivateKey.length === 64) {
      privateKey = decodedPrivateKey.slice(0, 32).toString('hex');
    }

    privateKey = encodeSensitiveText({ text: privateKey ?? '' });
    return {
      privateKey,
    };
  }

  override validateXprvt(): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    try {
      const secret = bs58.decode(privateKey);
      if (secret.length === 64) {
        const priv = secret.slice(0, 32).toString('hex');
        const validation = await this.baseValidatePrivateKey(priv);
        return validation;
      }
    } catch {
      // pass
    }

    return {
      isValid: false,
    };
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }
}
