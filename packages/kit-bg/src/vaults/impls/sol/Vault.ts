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
import bs58 from 'bs58';
import { isEmpty, isNil } from 'lodash';

import type { IEncodedTxSol } from '@onekeyhq/core/src/chains/sol/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
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
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import ClientSol from './sdkSol/ClientSol';

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
import type { Metadata } from '@metaplex-foundation/mpl-token-metadata';

import BigNumber from 'bignumber.js';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.sol.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  _getClientCache = memoizee(async () => new ClientSol(this.backgroundApi), {
    maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
  });

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
        const tokenSendAddress = tokenInfo?.tokenSendAddress;
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

        const destinationAtaInfo = await client.getAccountInfo(
          destinationAta.toString(),
        );

        if (isNFT) {
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
                destinationAtaInfo,
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
        if (!isNil(resp.blockhash) && !isNil(resp.lastValidBlockHeight)) {
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

  override buildDecodedTx(params: IBuildDecodedTxParams): Promise<IDecodedTx> {
    throw new Error('Method not implemented.');
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
