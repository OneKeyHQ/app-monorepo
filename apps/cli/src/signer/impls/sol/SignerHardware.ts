import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

import { OffchainMessage } from '@onekeyhq/core/src/chains/sol/sdkSol/OffchainMessage';
import { parseToNativeTx } from '@onekeyhq/core/src/chains/sol/sdkSol/parse';
import type { IEncodedTxSol } from '@onekeyhq/core/src/chains/sol/types';
import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
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

/**
 * SOL hardware signer. Mirrors `kit-bg/src/vaults/impls/sol/KeyringHardware`:
 * parse the bs58-encoded VersionedTransaction (or legacy Transaction), serialize
 * the message bytes to hex, ask the device to sign, then assemble the rawTx.
 */
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

    // ATA details are forwarded by the caller via unsignedTx.payload when SPL
    // transfers create a destination ATA — kit-bg does the same so the device
    // can render a clear "create token account" prompt. The CLI keeps the same
    // shape so the firmware UI is identical.
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
    if (!sig.signature) {
      throw new AppError(
        ERROR_CODES.BIZ_TRANSACTION_FAILED.code,
        'Hardware returned empty signature for SOL transaction.',
        'Retry the operation; if the failure persists, check device firmware.',
      );
    }

    const signatureBytes = Buffer.from(sig.signature, 'hex');
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
          payload?: { applicationDomain?: string };
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
      return bs58.encode(Buffer.from(sig.signature ?? '', 'hex'));
    }

    if (unsignedMsg.type === EMessageTypesSolana.SIGN_OFFCHAIN_MESSAGE) {
      const applicationDomain = unsignedMsg.payload?.applicationDomain;
      const result = await sdk.solSignOffchainMessage(
        this.device.connectId,
        this.device.deviceId,
        {
          path,
          messageHex,
          ...(applicationDomain
            ? {
                applicationDomainHex:
                  Buffer.from(applicationDomain).toString('hex'),
              }
            : {}),
          // @ts-expect-error firmware SDK accepts the format hint without typing it
          messageFormat: OffchainMessage.guessMessageFormat(
            Buffer.from(unsignedMsg.message ?? ''),
          ),
          ...commonParams,
        },
      );
      const sig = unwrapSDKResult<ISolSignMessagePayload>(
        result,
        'signMessage',
      );
      return bs58.encode(Buffer.from(sig.signature ?? '', 'hex'));
    }

    throw new AppError(
      ERROR_CODES.PARAM_INVALID_COMMAND.code,
      `SOL hardware signMessage does not support type "${unsignedMsg.type}".`,
      'Supported: commonSignMessage, solanaSignOffchainMessage.',
    );
  }
}
