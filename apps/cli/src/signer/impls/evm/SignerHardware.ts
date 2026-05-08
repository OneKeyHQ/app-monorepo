import {
  buildHardwareEvmTransaction,
  buildSignedTxFromSignatureEvm,
} from '@onekeyhq/core/src/chains/evm/sdkEvm';
import type {
  ICoreApiGetAddressItem,
  ICoreApiSignMsgPayload,
  ISignedTxPro,
} from '@onekeyhq/core/src/types';

import { unwrapSDKResult } from '../../../commands/device/hardware-sdk';
import { AppError, ERROR_CODES } from '../../../errors';
import { SignerHardwareBase } from '../../base/SignerHardwareBase';

import { resolveEvmPath, validateEvmNetworkId } from './evm-path';

import type {
  ISignTransactionPayload,
  ISignerGetAddressOptions,
} from '../../types';
import type { EVMSignedTx } from '@onekeyfe/hd-core';

interface IEvmAddressPayload {
  address: string;
  path: string;
}

interface IEvmSignMsgPayload {
  signature: string;
}

/**
 * EVM-specific hardware signer. Inherits unlock / passphrase / session-cache
 * plumbing from SignerHardwareBase; this class only knows how to translate an
 * ISigner call into the three EVM SDK methods.
 */
export class SignerHardware extends SignerHardwareBase {
  async getAddress(
    networkId: string,
    _options?: ISignerGetAddressOptions,
  ): Promise<ICoreApiGetAddressItem> {
    validateEvmNetworkId(networkId);
    const sdk = await this.getHardwareSDK();
    const commonParams = await this.getHwCommonParams();

    const result = await sdk.evmGetAddress(
      this.device.connectId,
      this.device.deviceId,
      {
        path: resolveEvmPath(0),
        showOnOneKey: false,
        ...commonParams,
      },
    );

    const payload = unwrapSDKResult<IEvmAddressPayload>(result, 'getAddress');
    return {
      address: payload.address ?? '',
      path: payload.path ?? '',
    } as ICoreApiGetAddressItem;
  }

  async signTransaction(
    payload: ISignTransactionPayload,
  ): Promise<ISignedTxPro> {
    validateEvmNetworkId(payload.networkId);
    const sdk = await this.getHardwareSDK();
    const commonParams = await this.getHwCommonParams();
    const { encodedTx } = payload.unsignedTx;

    const { hwTransaction, unsignedTx } = buildHardwareEvmTransaction(
      encodedTx as Parameters<typeof buildHardwareEvmTransaction>[0],
    );

    const result = await sdk.evmSignTransaction(
      this.device.connectId,
      this.device.deviceId,
      {
        path: payload.account.path,
        transaction: hwTransaction,
        ...commonParams,
      },
    );

    const sig = unwrapSDKResult<EVMSignedTx>(result, 'signTransaction');
    const { rawTx, txid } = buildSignedTxFromSignatureEvm({
      tx: unsignedTx,
      signature: sig,
    });
    return { rawTx, txid, encodedTx } as unknown as ISignedTxPro;
  }

  async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const sdk = await this.getHardwareSDK();
    const commonParams = await this.getHwCommonParams();

    const message = payload.unsignedMsg?.message ?? '';
    const path = payload.account?.path;
    if (!path) {
      throw new AppError(
        ERROR_CODES.PARAM_MISSING_REQUIRED.code,
        'signMessage requires payload.account.path',
        'Pass the full BIP-44 path derived from the active session address.',
      );
    }

    const isHex = /^0x[0-9a-fA-F]+$/.test(message);
    const messageHex = isHex
      ? message.slice(2)
      : Buffer.from(message, 'utf8').toString('hex');

    const result = await sdk.evmSignMessage(
      this.device.connectId,
      this.device.deviceId,
      {
        path,
        messageHex,
        ...commonParams,
      },
    );

    const sig = unwrapSDKResult<IEvmSignMsgPayload>(result, 'signMessage');
    return sig.signature ?? '';
  }
}
