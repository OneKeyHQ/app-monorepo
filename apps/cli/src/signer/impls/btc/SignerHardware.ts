import { Psbt, Transaction } from 'bitcoinjs-lib';

import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';
import type { ITxInputToSign } from '@onekeyhq/core/src/types/coreTypesTx';
import { IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import {
  CoreSDKLoader,
  unwrapSDKResult,
} from '../../../commands/device/hardware-sdk';
import { AppError, ERROR_CODES } from '../../../errors';
import { SignerHardwareBase } from '../../base/SignerHardwareBase';

import { resolveBtcAddressTypeInfo, validateBtcNetworkId } from './btc-path';

import type { IBtcSignerImpl } from './btc-path';
import type { IBtcAddressTypeInfo } from '../../../core/btc/address-types';
import type { ISignerHardwareConfig } from '../../base/SignerHardwareBase';
import type {
  ISignTransactionPayload,
  ISignerGetAddressOptions,
} from '../../types';

export interface ISignerHardwareBtcConfig extends ISignerHardwareConfig {
  impl: IBtcSignerImpl;
}

type IBtcEncodedInput = {
  txid: string;
  vout: number;
  value: string;
  address: string;
  path?: string;
};

type IBtcEncodedOutput = {
  address?: string;
  value: string;
  payload?: {
    isChange?: boolean;
    bip44Path?: string;
    opReturn?: string;
  };
};

type IBtcEncodedTx = {
  inputs?: IBtcEncodedInput[];
  outputs?: IBtcEncodedOutput[];
  psbtHex?: unknown;
  inputsToSign?: Array<{ index: number }>;
};

type IHardwareInput = {
  prev_index: number;
  prev_hash: string;
  amount: string;
  address_n: number[];
  script_type: string;
};

type IHardwareOutput =
  | {
      script_type: 'PAYTOADDRESS';
      address: string | undefined;
      amount: string;
    }
  | {
      script_type: string;
      address_n: number[];
      amount: string;
    }
  | {
      script_type: 'PAYTOOPRETURN';
      amount: '0';
      op_return_data: string;
    };

type IRefTransaction = {
  hash: string;
  version: number;
  inputs: Array<{
    prev_hash: string;
    prev_index: number;
    script_sig: string;
    sequence: number;
  }>;
  bin_outputs: Array<{
    amount: string;
    script_pubkey: string;
  }>;
  lock_time: number;
};

interface IBtcAddressPayload {
  address?: string;
  path?: string;
}

interface IBtcPublicKeyPayload {
  path?: string;
  xpub?: string;
  xpubSegwit?: string;
  node?: {
    public_key?: string;
    fingerprint?: number;
  };
  root_fingerprint?: number;
}

interface IBtcPsbtPayload {
  psbt: string;
}

interface IBtcSignedTxPayload {
  serializedTx: string;
  txid?: string;
}

export class SignerHardware extends SignerHardwareBase {
  private readonly impl: IBtcSignerImpl;

  // root_fingerprint is master-key derived and path-independent, so it's safe
  // to cache for the lifetime of the signer instance. This avoids an extra
  // btcGetPublicKey round-trip (and possible passphrase prompt) on every PSBT.
  private rootFingerprintHexCache?: string;

  constructor(config: ISignerHardwareBtcConfig) {
    super(config);
    this.impl = config.impl;
  }

  async getAddress(
    networkId: string,
    options?: ISignerGetAddressOptions,
  ): Promise<ICoreApiGetAddressItem> {
    validateBtcNetworkId(this.impl, networkId);
    const info = resolveBtcAddressTypeInfo(this.impl, options?.addressType);
    const sdk = await this.getHardwareSDK();
    const commonParams = await this.getHwCommonParams();

    const addressResult = await sdk.btcGetAddress(
      this.device.connectId,
      this.device.deviceId,
      {
        path: info.path,
        coin: this.getCoin(),
        showOnOneKey: false,
        ...commonParams,
      },
    );
    const pubKeyResult = await sdk.btcGetPublicKey(
      this.device.connectId,
      this.device.deviceId,
      {
        path: info.path,
        coin: this.getCoin(),
        showOnOneKey: false,
        ...commonParams,
      },
    );

    const address = unwrapSDKResult<IBtcAddressPayload>(
      addressResult,
      'getAddress',
    );
    const pubKey = unwrapSDKResult<IBtcPublicKeyPayload>(
      pubKeyResult,
      'getPublicKey',
    );
    const publicKey = pubKey.node?.public_key ?? '';
    if (!publicKey) {
      throw new AppError(
        ERROR_CODES.BIZ_UNKNOWN.code,
        'Hardware did not return BTC public key',
        'Reconnect the device or update the firmware',
      );
    }

    if (typeof pubKey.root_fingerprint === 'number') {
      this.rootFingerprintHexCache = pubKey.root_fingerprint
        .toString(16)
        .padStart(8, '0');
    }

    return {
      address: address.address ?? '',
      publicKey,
      path: address.path ?? info.path,
      relPath: info.relPath,
      addresses: {
        [info.relPath]: address.address ?? '',
      },
      __hwExtraInfo__:
        typeof pubKey.root_fingerprint === 'number'
          ? { rootFingerprint: pubKey.root_fingerprint }
          : undefined,
    } as ICoreApiGetAddressItem;
  }

  private async getRootFingerprintHex(): Promise<string> {
    if (this.rootFingerprintHexCache) return this.rootFingerprintHexCache;

    const sdk = await this.getHardwareSDK();
    const commonParams = await this.getHwCommonParams();
    const result = await sdk.btcGetPublicKey(
      this.device.connectId,
      this.device.deviceId,
      {
        path: "m/44'/0'/0'",
        coin: this.getCoin(),
        showOnOneKey: false,
        ...commonParams,
      },
    );
    const payload = unwrapSDKResult<IBtcPublicKeyPayload>(
      result,
      'getPublicKey',
    );
    if (typeof payload.root_fingerprint !== 'number') {
      throw new AppError(
        ERROR_CODES.BIZ_UNKNOWN.code,
        'Hardware did not return root fingerprint',
        'Reconnect the device or update the firmware',
      );
    }
    this.rootFingerprintHexCache = payload.root_fingerprint
      .toString(16)
      .padStart(8, '0');
    return this.rootFingerprintHexCache;
  }

  private async injectPsbtDerivations(params: {
    psbt: Psbt;
    inputsToSign: ITxInputToSign[];
    addressTypeInfo: IBtcAddressTypeInfo;
    accountAddress: string;
    accountPublicKey: string | undefined;
  }): Promise<void> {
    const { psbt, inputsToSign, addressTypeInfo, accountAddress } = params;
    const fingerprintHex = await this.getRootFingerprintHex();
    const masterFingerprint = Buffer.from(fingerprintHex, 'hex');
    const isTaproot =
      addressTypeInfo.addressEncoding === EAddressEncodings.P2TR;

    for (const input of inputsToSign) {
      const inputPubKey = Buffer.from(input.publicKey, 'hex');
      if (isTaproot) {
        psbt.updateInput(input.index, {
          tapBip32Derivation: [
            {
              masterFingerprint,
              pubkey: inputPubKey.subarray(1, 33),
              path: addressTypeInfo.path,
              leafHashes: [],
            },
          ],
        });
      } else {
        psbt.updateInput(input.index, {
          bip32Derivation: [
            {
              masterFingerprint,
              pubkey: inputPubKey,
              path: addressTypeInfo.path,
            },
          ],
        });
      }
    }

    if (isTaproot && params.accountPublicKey) {
      const accountPub = Buffer.from(params.accountPublicKey, 'hex');
      for (let i = 0; i < psbt.txOutputs.length; i += 1) {
        const output = psbt.txOutputs[i];
        if (output.address === accountAddress && psbt.txOutputs.length > 1) {
          try {
            psbt.updateOutput(i, {
              tapInternalKey: accountPub.subarray(1, 33),
              tapBip32Derivation: [
                {
                  masterFingerprint,
                  pubkey: accountPub.subarray(1, 33),
                  path: addressTypeInfo.path,
                  leafHashes: [],
                },
              ],
            });
          } catch {
            // updateOutput throws when fields already exist; safe to ignore.
          }
        }
      }
    }
  }

  async signTransaction(
    payload: ISignTransactionPayload,
  ): Promise<ISignedTxPro> {
    validateBtcNetworkId(this.impl, payload.networkId);
    const sdk = await this.getHardwareSDK();
    const commonParams = await this.getHwCommonParams();
    const encodedTx = payload.unsignedTx.encodedTx as IBtcEncodedTx;

    if (typeof encodedTx.psbtHex === 'string') {
      if (!payload.signOnly && !this.hasPsbtInputsToSign(encodedTx)) {
        throw new AppError(
          ERROR_CODES.PARAM_MISSING_REQUIRED.code,
          'BTC PSBT signing requires encodedTx.inputsToSign.',
          'Pass inputsToSign or set signOnly when only a signed PSBT is required.',
        );
      }

      const psbtAddressTypeInfo = resolveBtcAddressTypeInfo(
        this.impl,
        payload.addressType,
      );
      const psbtNetwork = getBtcForkNetwork(this.impl);
      const enrichedPsbt = Psbt.fromHex(encodedTx.psbtHex, {
        network: psbtNetwork,
      });
      const psbtInputsToSign = encodedTx.inputsToSign as
        | ITxInputToSign[]
        | undefined;
      if (psbtInputsToSign?.length) {
        await this.injectPsbtDerivations({
          psbt: enrichedPsbt,
          inputsToSign: psbtInputsToSign,
          addressTypeInfo: psbtAddressTypeInfo,
          accountAddress: payload.account.address,
          accountPublicKey: payload.account.pub,
        });
      }
      const enrichedPsbtHex = enrichedPsbt.toHex();

      const result = await sdk.btcSignPsbt(
        this.device.connectId,
        this.device.deviceId,
        {
          psbt: enrichedPsbtHex,
          coin: this.getCoin(),
          ...commonParams,
        },
      );
      const signed = unwrapSDKResult<IBtcPsbtPayload>(result, 'signPsbt');

      if (payload.signOnly) {
        return {
          rawTx: '',
          txid: '',
          encodedTx,
          psbtHex: signed.psbt,
          finalizedPsbtHex: signed.psbt,
        } as unknown as ISignedTxPro;
      }

      if (!this.hasPsbtInputsToSign(encodedTx)) {
        throw new AppError(
          ERROR_CODES.PARAM_MISSING_REQUIRED.code,
          'BTC PSBT signing requires encodedTx.inputsToSign.',
          'Pass inputsToSign or set signOnly when only a signed PSBT is required.',
        );
      }
      const finalized = this.finalizeSignedPsbt(
        signed.psbt,
        encodedTx.inputsToSign,
      );
      return {
        rawTx: finalized.rawTx,
        txid: finalized.txid,
        encodedTx,
        psbtHex: signed.psbt,
        finalizedPsbtHex: finalized.finalizedPsbtHex,
      } as unknown as ISignedTxPro;
    }

    const signParams = {
      coin: this.getCoin(),
      inputs: await Promise.all(
        (encodedTx.inputs ?? []).map((input) =>
          this.buildHardwareInput(input, payload),
        ),
      ),
      outputs: await Promise.all(
        (encodedTx.outputs ?? []).map((output) =>
          this.buildHardwareOutput(output),
        ),
      ),
      refTxs: this.buildRefTxs(payload),
      ...commonParams,
    } as Parameters<typeof sdk.btcSignTransaction>[2];

    const result = await sdk.btcSignTransaction(
      this.device.connectId,
      this.device.deviceId,
      signParams,
    );

    const signed = unwrapSDKResult<IBtcSignedTxPayload>(
      result,
      'signTransaction',
    );
    const txid =
      signed.txid || Transaction.fromHex(signed.serializedTx).getId();
    return {
      rawTx: signed.serializedTx,
      txid,
      encodedTx,
    } as unknown as ISignedTxPro;
  }

  async signMessage(_payload: ICoreApiSignMsgPayload): Promise<string> {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CONFIG.code,
      'BTC message signing is not exposed by the CLI.',
      'Use transaction or PSBT signing instead.',
    );
  }

  private getCoin(): 'bitcoin' | 'testnet' {
    return this.impl === IMPL_TBTC ? 'testnet' : 'bitcoin';
  }

  private hasPsbtInputsToSign(
    encodedTx: IBtcEncodedTx,
  ): encodedTx is IBtcEncodedTx & { inputsToSign: Array<{ index: number }> } {
    return (
      Array.isArray(encodedTx.inputsToSign) &&
      encodedTx.inputsToSign.every((item) => typeof item.index === 'number')
    );
  }

  private finalizeSignedPsbt(
    signedPsbt: string,
    inputsToSign: Array<{ index: number }>,
  ): { rawTx: string; txid: string; finalizedPsbtHex: string } {
    try {
      const psbt = Psbt.fromHex(signedPsbt, {
        network: getBtcForkNetwork(this.impl),
      });
      inputsToSign.forEach((item) => {
        psbt.finalizeInput(item.index);
      });
      const tx = psbt.extractTransaction();
      return {
        rawTx: tx.toHex(),
        txid: tx.getId(),
        finalizedPsbtHex: psbt.toHex(),
      };
    } catch (error) {
      throw new AppError(
        ERROR_CODES.BIZ_UNKNOWN.code,
        `Failed to finalize signed BTC PSBT: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'Check PSBT inputsToSign and signed PSBT data.',
      );
    }
  }

  private async buildHardwareInput(
    input: IBtcEncodedInput,
    payload: ISignTransactionPayload,
  ): Promise<IHardwareInput> {
    const { getHDPath, getScriptType } = await CoreSDKLoader();
    const path =
      input.path ||
      payload.btcExtraInfo?.addressToPath?.[input.address]?.fullPath ||
      payload.account.path;
    const addressN = getHDPath(path);

    return {
      prev_index: input.vout,
      prev_hash: input.txid,
      amount: input.value,
      address_n: addressN,
      script_type: getScriptType(addressN),
    };
  }

  private async buildHardwareOutput(
    output: IBtcEncodedOutput,
  ): Promise<IHardwareOutput> {
    const { isChange, bip44Path, opReturn } = output.payload || {};

    if (opReturn && typeof opReturn === 'string' && opReturn.length > 0) {
      return {
        script_type: 'PAYTOOPRETURN',
        amount: '0',
        op_return_data: Buffer.from(opReturn).toString('hex'),
      };
    }

    if (isChange && bip44Path) {
      const { getHDPath, getOutputScriptType } = await CoreSDKLoader();
      const addressN = getHDPath(bip44Path);
      return {
        script_type: getOutputScriptType(addressN),
        address_n: addressN,
        amount: output.value,
      };
    }

    return {
      script_type: 'PAYTOADDRESS',
      address: output.address,
      amount: output.value,
    };
  }

  private buildRefTxs(payload: ISignTransactionPayload): IRefTransaction[] {
    return Object.values(payload.btcExtraInfo?.nonWitnessPrevTxs ?? {}).map(
      (rawTx) => this.buildPrevTx(rawTx),
    );
  }

  private buildPrevTx(rawTx: string): IRefTransaction {
    const tx = Transaction.fromHex(rawTx);

    return {
      hash: tx.getId(),
      version: tx.version,
      inputs: tx.ins.map((input) => ({
        // Buffer.toReversed() returns Uint8Array which lacks .toString('hex'),
        // so we keep the in-place .reverse() form here.
        // oxlint-disable-next-line unicorn/no-array-reverse
        prev_hash: Buffer.from(input.hash).reverse().toString('hex'),
        prev_index: input.index,
        script_sig: Buffer.from(input.script).toString('hex'),
        sequence: input.sequence,
      })),
      bin_outputs: tx.outs.map((output) => ({
        amount: output.value.toString(),
        script_pubkey: Buffer.from(output.script).toString('hex'),
      })),
      lock_time: tx.locktime,
    };
  }
}
