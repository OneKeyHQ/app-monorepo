import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import {
  OffchainMessage,
  classifyOffchainMessageVersion,
} from '@onekeyhq/core/src/chains/sol/sdkSol/OffchainMessage';
import { parseToNativeTx } from '@onekeyhq/core/src/chains/sol/sdkSol/parse';
import type { IEncodedTxSol } from '@onekeyhq/core/src/chains/sol/types';
import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
  IUnsignedMessageSolana,
} from '@onekeyhq/core/src/types';
import {
  EMessageTypesCommon,
  EMessageTypesSolana,
} from '@onekeyhq/shared/types/message';

import { unwrapSDKResult } from '../../../commands/device/hardware-sdk';
import { AppError, ERROR_CODES } from '../../../errors';
import { SignerHardwareBase } from '../../base/SignerHardwareBase';

import { resolveSolPath, validateSolNetworkId } from './sol-path';

import type {
  ISignTransactionPayload,
  ISignerGetAddressOptions,
} from '../../types';

interface ISolGetAddressPayload {
  address?: string;
  path?: string;
}

interface ISolSignTxPayload {
  signature?: string;
}

interface ISolSignMessagePayload {
  signature?: string;
}

interface ISolSignTransactionExtraInfo {
  ata_details: Array<{
    owner_address: string;
    program_id: string;
    mint_address: string;
    associated_token_address: string;
  }>;
}

// Ed25519 signatures are always 64 bytes. A malformed hex string from the
// firmware would otherwise be silently truncated by Buffer.from(_, 'hex')
// and surface later as a cryptic web3.js error.
const SOL_SIGNATURE_BYTES = 64;

export function decodeEd25519Signature(
  signatureHex: string | undefined,
  context: 'signTransaction' | 'signMessage',
): Buffer {
  if (!signatureHex) {
    throw new AppError(
      ERROR_CODES.BIZ_TRANSACTION_FAILED.code,
      `Hardware returned empty signature for SOL ${context}.`,
      'Retry the operation; if the failure persists, check device firmware.',
    );
  }
  const bytes = Buffer.from(signatureHex, 'hex');
  if (bytes.length !== SOL_SIGNATURE_BYTES) {
    throw new AppError(
      ERROR_CODES.BIZ_TRANSACTION_FAILED.code,
      `Hardware returned SOL ${context} signature with unexpected length: ${bytes.length} bytes (expected ${SOL_SIGNATURE_BYTES}).`,
      'Retry the operation; if the failure persists, check device firmware.',
    );
  }
  return bytes;
}

export class SignerHardware extends SignerHardwareBase {
  async getAddress(
    networkId: string,
    _options?: ISignerGetAddressOptions,
  ): Promise<ICoreApiGetAddressItem> {
    validateSolNetworkId(networkId);
    const sdk = await this.getHardwareSDK();
    const commonParams = await this.getHwCommonParams();

    const result = await sdk.solGetAddress(
      this.device.connectId,
      this.device.deviceId,
      {
        path: resolveSolPath(0),
        showOnOneKey: false,
        ...commonParams,
      },
    );

    const payload = unwrapSDKResult<ISolGetAddressPayload>(
      result,
      'getAddress',
    );
    return {
      address: payload.address ?? '',
      path: payload.path ?? '',
    } as ICoreApiGetAddressItem;
  }

  async signTransaction(
    payload: ISignTransactionPayload,
  ): Promise<ISignedTxPro> {
    validateSolNetworkId(payload.networkId);
    const sdk = await this.getHardwareSDK();
    const commonParams = await this.getHwCommonParams();

    const encodedTx = payload.unsignedTx.encodedTx as unknown as IEncodedTxSol;
    const transaction = parseToNativeTx(encodedTx);
    if (!transaction) {
      throw new AppError(
        ERROR_CODES.INVALID_TX.code,
        'Failed to parse SOL transaction.',
        'Verify the encodedTx is a bs58-encoded Transaction or VersionedTransaction.',
      );
    }

    if (!payload.account.path) {
      throw new AppError(
        ERROR_CODES.PARAM_MISSING_REQUIRED.code,
        'signTransaction requires payload.account.path',
        "Pass the full BIP-44 SOL path (e.g. m/44'/501'/0'/0').",
      );
    }
    if (!payload.account.address) {
      throw new AppError(
        ERROR_CODES.PARAM_MISSING_REQUIRED.code,
        'signTransaction requires payload.account.address',
        'Pass the SOL fee-payer address (base58 public key).',
      );
    }

    const isVersionedTransaction = transaction instanceof VersionedTransaction;
    const rawTxHex = isVersionedTransaction
      ? Buffer.from(transaction.message.serialize()).toString('hex')
      : transaction.serializeMessage().toString('hex');

    // Firmware expects snake_case ata_details fields; forwarded when the
    // build step created a destination ATA so the device can render the prompt.
    const ataDetails = (
      payload.unsignedTx as unknown as {
        payload?: {
          ataDetails?: Array<{
            owner: string;
            programId: string;
            mintAddress: string;
            associatedTokenAddress: string;
          }>;
        };
      }
    ).payload?.ataDetails;
    const extraInfo: ISolSignTransactionExtraInfo | undefined =
      ataDetails?.length
        ? {
            ata_details: ataDetails.map((ata) => ({
              owner_address: ata.owner,
              program_id: ata.programId,
              mint_address: ata.mintAddress,
              associated_token_address: ata.associatedTokenAddress,
            })),
          }
        : undefined;

    const result = await sdk.solSignTransaction(
      this.device.connectId,
      this.device.deviceId,
      {
        path: payload.account.path,
        rawTx: rawTxHex,
        ...(extraInfo ? { extraInfo } : {}),
        ...commonParams,
      },
    );

    const sig = unwrapSDKResult<ISolSignTxPayload>(result, 'signTransaction');
    const signatureBytes = decodeEd25519Signature(
      sig.signature,
      'signTransaction',
    );
    const feePayer = new PublicKey(payload.account.address);
    transaction.addSignature(feePayer, signatureBytes);

    return {
      txid: bs58.encode(signatureBytes),
      encodedTx,
      rawTx: Buffer.from(
        transaction.serialize({ requireAllSignatures: false }),
      ).toString('base64'),
    } as unknown as ISignedTxPro;
  }

  async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const sdk = await this.getHardwareSDK();
    const commonParams = await this.getHwCommonParams();

    const path = payload.account?.path;
    if (!path) {
      throw new AppError(
        ERROR_CODES.PARAM_MISSING_REQUIRED.code,
        'signMessage requires payload.account.path',
        'Pass the full BIP-44 path derived from the active SOL session address.',
      );
    }

    const unsignedMsg = payload.unsignedMsg as unknown as
      | {
          type: string;
          message: string;
          payload?: IUnsignedMessageSolana['payload'];
        }
      | undefined;
    if (!unsignedMsg) {
      throw new AppError(
        ERROR_CODES.PARAM_MISSING_REQUIRED.code,
        'signMessage requires payload.unsignedMsg',
        'Provide either a SIGN_MESSAGE or SIGN_OFFCHAIN_MESSAGE message.',
      );
    }

    const messageHex = Buffer.from(unsignedMsg.message ?? '').toString('hex');

    if (unsignedMsg.type === EMessageTypesCommon.SIGN_MESSAGE) {
      const result = await sdk.solSignMessage(
        this.device.connectId,
        this.device.deviceId,
        {
          path,
          messageHex,
          ...commonParams,
        },
      );
      const sig = unwrapSDKResult<ISolSignMessagePayload>(
        result,
        'signMessage',
      );
      return bs58.encode(decodeEd25519Signature(sig.signature, 'signMessage'));
    }

    if (unsignedMsg.type === EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE) {
      const versionKind = classifyOffchainMessageVersion(
        unsignedMsg.payload?.version,
      );
      if (versionKind === 'v1') {
        const requiredSigners =
          unsignedMsg.payload?.version === 1
            ? unsignedMsg.payload.requiredSigners
            : undefined;
        if (!requiredSigners?.length) {
          throw new AppError(
            ERROR_CODES.INVALID_PAYLOAD.code,
            'Version 1 Solana offchain messages require at least one signer.',
            'Pass requiredSigners as base58-encoded Solana public keys.',
          );
        }
        if (
          !payload.account?.address ||
          !requiredSigners.includes(payload.account.address)
        ) {
          throw new AppError(
            ERROR_CODES.INVALID_PAYLOAD.code,
            'Version 1 requiredSigners must include the signing account.',
            'Add payload.account.address to unsignedMsg.payload.requiredSigners.',
          );
        }

        const requiredSignerBytes = requiredSigners.map((signer) =>
          bs58.decode(signer),
        );
        OffchainMessage.createOffChainMessageV1Bytes({
          message: unsignedMsg.message,
          requiredSigners: requiredSignerBytes,
        });

        const result = await sdk.solSignOffchainMessage(
          this.device.connectId,
          this.device.deviceId,
          {
            path,
            messageHex,
            messageVersion: 1,
            requiredSigners: requiredSignerBytes
              .map((signer) => Buffer.from(signer).toString('hex'))
              .toSorted(),
            ...commonParams,
          },
        );
        const sig = unwrapSDKResult<ISolSignMessagePayload>(
          result,
          'signMessage',
        );
        return bs58.encode(
          decodeEd25519Signature(sig.signature, 'signMessage'),
        );
      }
      if (versionKind === 'unsupported') {
        throw new AppError(
          ERROR_CODES.INVALID_PAYLOAD.code,
          `Unsupported Solana offchain message version: ${String(
            unsignedMsg.payload?.version,
          )}`,
          'Only version 0 and version 1 are supported.',
        );
      }
      throw new AppError(
        ERROR_CODES.INVALID_PAYLOAD.code,
        'Version 0 Solana offchain messages are not supported by hardware wallets.',
        'Use a version 1 Solana offchain message.',
      );
    }

    throw new AppError(
      ERROR_CODES.PARAM_INVALID_COMMAND.code,
      `SOL hardware signMessage does not support type "${unsignedMsg.type}".`,
      'Supported: commonSignMessage, solanaSignOffchainMessage.',
    );
  }
}
