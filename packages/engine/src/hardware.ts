/**
 * hardware interface wrapper
 */
import { splitSignature } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { serialize } from '@ethersproject/transactions';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { BigNumber } from 'bignumber.js';
import { TypedDataUtils } from 'eth-sig-util';

import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import type { IPrepareHardwareAccountsParams } from '@onekeyhq/engine/src/vaults/types';
import { isHexString } from '@onekeyhq/kit/src/utils/helper';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import * as engineUtils from '@onekeyhq/shared/src/engine/engineUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';

import {
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from './errors';
import { ETHMessageTypes } from './types/message';

import type { IUnsignedMessageEvm } from './vaults/impl/evm/Vault';
import type { WalletPassphraseState } from './vaults/keyring/KeyringHardwareBase';
import type { UnsignedTransaction } from '@ethersproject/transactions';
import type {
  CoreApi,
  EVMTransaction,
  EVMTransactionEIP1559,
  Success,
  Unsuccessful,
} from '@onekeyfe/hd-core';

/**
 * get Eth address from the hardware wallet with the specified derivation path
 * @param path drivation path
 * @param display show address on the screen
 * @returns
 * @throws {OneKeyHardwareError}
 */
export async function ethereumGetAddress(
  HardwareSDK: CoreApi,
  connectId: string,
  deviceId: string,
  path: string | number[],
  display = false,
  passphraseState?: WalletPassphraseState,
  chainId?: number,
): Promise<string> {
  let response;
  try {
    response = await HardwareSDK.evmGetAddress(connectId, deviceId, {
      path,
      showOnOneKey: display,
      chainId,
      ...passphraseState,
    });
  } catch (error: any) {
    console.error(error);
    throw new OneKeyHardwareError(error);
  }
  if (response.success && !!response.payload?.address) {
    return engineUtils.fixAddressCase({
      address: response.payload.address,
      impl: IMPL_EVM,
    });
  }

  throw convertDeviceError(response.payload);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function solanaSignTransaction(...args: any[]): Promise<any> {
  throw new NotImplemented();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function btcSignTransaction(...args: any[]): Promise<any> {
  throw new NotImplemented();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function nearSignTransaction(...args: any[]): Promise<any> {
  throw new NotImplemented();
}

/**
 * get Solana address from the hardware wallet with the specified derivation path
 * @param path drivation path
 * @param display show address on the screen
 * @returns
 * @throws {OneKeyHardwareError}
 */
export async function solanaGetAddress(
  path: string | number[],
  display = false,
): Promise<string> {
  // let response;
  // try {
  //   response = await OneKeyConnect.solanaGetAddress(
  //     path,
  //     // showOnTrezor: display,
  //   );
  // } catch (error: any) {
  //   console.error(error);
  //   throw new OneKeyHardwareError(error);
  // }
  // if (response.success) {
  //   return response.payload.address;
  // }
  // console.error(response.payload);
  // throw new OneKeyHardwareError(`solanaGetAddress: ${response.payload.error}`);
  console.error('Not implemented', path, display);
  return Promise.reject(new Error('not implemented'));
}

function getResultFromResponse<T>(response: Unsuccessful | Success<T>): T {
  if (!response.success) {
    throw convertDeviceError(response.payload);
  }
  return response.payload;
}

export async function ethereumSignMessage({
  HardwareSDK,
  connectId,
  deviceId,
  passphraseState,
  path,
  message,
  chainId,
}: {
  HardwareSDK: CoreApi;
  connectId: string;
  deviceId: string;
  passphraseState?: WalletPassphraseState;
  path: string;
  message: IUnsignedMessageEvm;
  chainId: number;
}): Promise<string> {
  // const features = await getFeatures();
  if (message.type === ETHMessageTypes.TYPED_DATA_V1) {
    throw web3Errors.provider.unsupportedMethod(
      `Sign message method=${message.type} not supported for this device`,
    );
  }

  if (
    message.type === ETHMessageTypes.ETH_SIGN ||
    message.type === ETHMessageTypes.PERSONAL_SIGN
  ) {
    let messageBuffer: Buffer;
    try {
      if (!isHexString(message.message)) throw new Error('not hex string');

      messageBuffer = Buffer.from(message.message.replace('0x', ''), 'hex');
    } catch (error) {
      messageBuffer = Buffer.from('');
    }

    let messageHex = message.message;
    if (messageBuffer.length === 0) {
      messageHex = Buffer.from(message.message, 'utf-8').toString('hex');
    }

    const res = await HardwareSDK.evmSignMessage(connectId, deviceId, {
      path,
      messageHex,
      chainId,
      ...passphraseState,
    });

    if (!res.success) {
      throw convertDeviceError(res.payload);
    }

    const result = getResultFromResponse(res);
    return `0x${result?.signature || ''}`;
  }

  if (
    message.type === ETHMessageTypes.TYPED_DATA_V3 ||
    message.type === ETHMessageTypes.TYPED_DATA_V4
  ) {
    const useV4 = message.type === ETHMessageTypes.TYPED_DATA_V4;
    const data = JSON.parse(message.message);
    const typedData = TypedDataUtils.sanitizeData(data);
    const domainHash = TypedDataUtils.hashStruct(
      'EIP712Domain',
      typedData.domain,
      typedData.types,
      useV4,
    ).toString('hex');
    const messageHash = TypedDataUtils.hashStruct(
      // @ts-expect-error
      typedData.primaryType,
      typedData.message,
      typedData.types,
      useV4,
    ).toString('hex');

    const res = await HardwareSDK.evmSignTypedData(connectId, deviceId, {
      path,
      metamaskV4Compat: !!useV4,
      data,
      domainHash,
      messageHash,
      chainId,
      ...passphraseState,
    });

    if (!res.success) {
      throw convertDeviceError(res.payload);
    }

    const result = getResultFromResponse(res);
    return `0x${result?.signature || ''}`;
  }

  throw web3Errors.rpc.methodNotFound(
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `Sign message method=${message.type} not found`,
  );
}

/**
 * sign Eth transaction with the hardware wallet
 * @param params
 * @returns
 * @throws {OneKeyHardwareError}
 */
export async function ethereumSignTransaction(
  HardwareSDK: CoreApi,
  connectId: string,
  deviceId: string,
  path: string,
  chainId: string,
  unsignedTx: UnsignedTx,
  passphraseState?: WalletPassphraseState,
): Promise<SignedTx> {
  let response;

  const output = unsignedTx.outputs[0];
  let to: string;
  let value: string;
  if (typeof output.tokenAddress === 'undefined') {
    to = output.address;
    value = toBigIntHex(output.value);
  } else {
    to = output.tokenAddress;
    value = '0x0';
  }
  if (
    typeof unsignedTx.feeLimit === 'undefined' ||
    typeof unsignedTx.nonce === 'undefined'
  ) {
    throw new OneKeyInternalError('Incomplete unsigned tx.');
  }

  const isEip1559 = unsignedTx.payload?.EIP1559Enabled;

  let txToSign: EVMTransaction | EVMTransactionEIP1559;

  if (isEip1559) {
    txToSign = {
      to,
      value,
      gasLimit: toBigIntHex(unsignedTx.feeLimit),
      nonce: `0x${unsignedTx.nonce.toString(16)}`,
      data: unsignedTx.payload?.data || '0x',
      chainId: parseInt(chainId),
      maxFeePerGas: toBigIntHex(unsignedTx.payload.maxFeePerGas),
      maxPriorityFeePerGas: toBigIntHex(
        unsignedTx.payload.maxPriorityFeePerGas,
      ),
    };
  } else {
    txToSign = {
      to,
      value,
      gasPrice: toBigIntHex(unsignedTx.feePricePerUnit ?? new BigNumber(0)),
      gasLimit: toBigIntHex(unsignedTx.feeLimit),
      nonce: `0x${unsignedTx.nonce.toString(16)}`,
      data: unsignedTx.payload?.data || '0x',
      chainId: parseInt(chainId),
    };
  }

  const tx: UnsignedTransaction = {
    to: txToSign.to,
    value: txToSign.value,
    gasPrice: txToSign.gasPrice,
    gasLimit: txToSign.gasLimit,
    nonce: parseInt(txToSign.nonce, 16),
    data: txToSign.data,
    chainId: txToSign.chainId,
  };

  if (isEip1559) {
    tx.type = 2;
    tx.maxFeePerGas = txToSign?.maxFeePerGas ?? undefined;
    tx.maxPriorityFeePerGas = txToSign?.maxPriorityFeePerGas ?? undefined;
  }

  try {
    response = await HardwareSDK.evmSignTransaction(connectId, deviceId, {
      path,
      transaction: txToSign,
      ...passphraseState,
    });
  } catch (error: any) {
    console.error(error);
    throw new OneKeyHardwareError(error);
  }

  if (response.success) {
    const { v, r, s } = response.payload;
    /**
     * sdk legacy return {v,r,s}; eip1559 return {recoveryParam,r,s}
     * splitSignature auto convert v to recoveryParam
     */
    const signature = splitSignature({
      v: Number(v),
      r,
      s,
    });
    const rawTx = serialize(tx, signature);
    const txid = keccak256(rawTx);
    return { txid, rawTx };
  }
  throw convertDeviceError(response.payload);
}

export async function getXpubs(
  HardwareSDK: CoreApi,
  impl: string,
  paths: Array<string>,
  outputFormat: 'xpub' | 'pub' | 'address',
  type: IPrepareHardwareAccountsParams['type'],
  connectId: string,
  deviceId: string,
  passphraseState?: WalletPassphraseState,
  chainId?: number,
): Promise<Array<{ path: string; info: string }>> {
  if (impl !== IMPL_EVM || outputFormat !== 'address') {
    return Promise.resolve([]);
  }

  const isBundle = paths.length > 1;

  let response;
  try {
    if (isBundle) {
      response = await HardwareSDK.evmGetAddress(connectId, deviceId, {
        bundle: paths.map((path) => ({
          path,
          /**
           * Search accounts not show detail at device.Only show on device when add accounts into wallet.
           */
          showOnOneKey: false,
          chainId,
        })),
        ...passphraseState,
      });
    } else {
      response = await HardwareSDK.evmGetAddress(connectId, deviceId, {
        path: paths[0],
        showOnOneKey: false,
        chainId,
        ...passphraseState,
      });
    }
  } catch (error: any) {
    console.error(error);
    throw new OneKeyHardwareError(error);
  }

  if (response.success) {
    if (response.payload instanceof Array) {
      return response.payload.map(({ path, address }) => ({
        path,
        info: engineUtils.fixAddressCase({ address, impl }),
      }));
    }
    return [
      {
        path: response.payload.path,
        info: engineUtils.fixAddressCase({
          address: response.payload.address,
          impl,
        }),
      },
    ];
  }
  throw convertDeviceError(response.payload);
}
