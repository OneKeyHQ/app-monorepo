/**
 * hardware interface wrapper
 */
import { splitSignature } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { UnsignedTransaction, serialize } from '@ethersproject/transactions';
import { toBigIntHex } from '@onekeyfe/blockchain-libs/dist/basic/bignumber-plus';
import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import {
  DeviceSettingsParams,
  Features,
  Success,
  Unsuccessful,
} from '@onekeyfe/hd-core';
import { BigNumber } from 'bignumber.js';
import { TypedDataUtils } from 'eth-sig-util';

import type { IPrepareHardwareAccountsParams } from '@onekeyhq/engine/src/vaults/types';
import { HardwareSDK } from '@onekeyhq/kit/src/utils/hardware';

import { IMPL_EVM } from './constants';
import * as engineUtils from './engineUtils';
import {
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from './errors';
import { ETHMessageTypes } from './types/message';

import type { IUnsignedMessageEvm } from './vaults/impl/evm/Vault';
import type { EVMTransaction, EVMTransactionEIP1559 } from '@onekeyfe/hd-core';

/**
 * Get hardware wallet info
 * @returns {Promise<Features>}
 * @throws {OneKeyInternalError}
 * @throws {OneKeyHardwareError}
 */
export async function getFeatures(): Promise<Features> {
  let response;
  try {
    response = await HardwareSDK.getFeatures();
    console.log('getFeatures', response);
  } catch (error: any) {
    throw new OneKeyHardwareError(error);
  }
  if (response.success) {
    return response.payload;
  }
  console.error(response.payload);
  throw new OneKeyHardwareError({
    code: response.payload.code,
    message: response.payload.error,
  });
}

/**
 * Change the pin of the hardware wallet
 * @param remove {boolean}
 * @returns {Promise<void>}
 * @throws {OneKeyHardwareError}
 * @throws {OneKeyInternalError}
 */
export async function changePin(
  connectId: string,
  remove = false,
): Promise<void> {
  let response;
  try {
    response = await HardwareSDK.deviceChangePin(connectId, { remove });
  } catch (error: any) {
    console.error(error);
    throw new OneKeyHardwareError(error);
  }
  if (response.success) {
    return;
  }
  console.error(response.payload);
  throw new OneKeyHardwareError({
    code: response.payload.code,
    message: `changePin: ${response.payload.error}`,
  });
}

/**
 * apply settings to the hardware wallet
 */

export async function applySettings(
  connectId: string,
  settings: DeviceSettingsParams,
): Promise<void> {
  let response;
  try {
    response = await HardwareSDK.deviceSettings(connectId, settings);
  } catch (error: any) {
    console.error(error);
    throw new OneKeyHardwareError(error);
  }
  if (response.success) {
    return;
  }
  console.error(response.payload);
  throw new OneKeyHardwareError({
    code: response.payload.code,
    message: `applySettings: ${response.payload.error}`,
  });
}
/**
 * get Eth address from the hardware wallet with the specified derivation path
 * @param path drivation path
 * @param display show address on the screen
 * @returns
 * @throws {OneKeyHardwareError}
 */
export async function ethereumGetAddress(
  connectId: string,
  path: string | number[],
  display = false,
): Promise<string> {
  let response;
  try {
    response = await HardwareSDK.evmGetAddress(connectId, {
      path,
      showOnOneKey: display,
    });
  } catch (error: any) {
    console.error(error);
    throw new OneKeyHardwareError(error);
  }
  if (response.success) {
    return engineUtils.fixAddressCase({
      address: response.payload.address,
      impl: IMPL_EVM,
    });
  }
  console.error(response.payload);
  throw new OneKeyHardwareError({
    code: response.payload.code,
    message: response.payload.error,
  });
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
    const { error, code } = response.payload;
    throw new OneKeyHardwareError({
      code,
      message: error,
    });
  }
  return response.payload;
}

export async function ethereumSignMessage({
  connectId,
  path,
  message,
}: {
  connectId: string;
  path: string;
  message: IUnsignedMessageEvm;
}): Promise<string> {
  // const features = await getFeatures();
  if (
    message.type === ETHMessageTypes.ETH_SIGN ||
    message.type === ETHMessageTypes.TYPED_DATA_V1
  ) {
    throw web3Errors.provider.unsupportedMethod(
      `Sign message method=${message.type} not supported for this device`,
    );
  }

  if (message.type === ETHMessageTypes.PERSONAL_SIGN) {
    // TODO non hex sign (utf8)
    const res = await HardwareSDK.evmSignMessage(connectId, {
      path,
      messageHex: message.message,
    });
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

    const res = await HardwareSDK.evmSignMessageEIP712(connectId, {
      path,
      domainHash,
      messageHash,
    });
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
  connectId: string,
  path: string,
  chainId: string,
  unsignedTx: UnsignedTx,
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
    response = await HardwareSDK.evmSignTransaction(connectId, {
      path,
      transaction: txToSign,
    });
  } catch (error: any) {
    console.error(error);
    throw new OneKeyHardwareError(error);
  }

  if (response.success) {
    const { v, r, s } = response.payload;
    // this translate is in order to compatible with the blockchain-libs implementation
    const recoveryParam = 1 - (Number(v) % 2);
    const signature = splitSignature({
      recoveryParam,
      r,
      s,
    });
    const rawTx = serialize(tx, signature);
    const txid = keccak256(rawTx);
    return { txid, rawTx };
  }
  console.error(response.payload);
  throw new OneKeyHardwareError({
    code: response.payload.code,
    message: response.payload.error,
  });
}

export async function getXpubs(
  impl: string,
  paths: Array<string>,
  outputFormat: 'xpub' | 'pub' | 'address',
  type: IPrepareHardwareAccountsParams['type'],
  connectId: string,
): Promise<Array<{ path: string; info: string }>> {
  if (impl !== IMPL_EVM || outputFormat !== 'address') {
    return Promise.resolve([]);
  }

  const isBundle = paths.length > 1;

  let response;
  try {
    if (isBundle) {
      response = await HardwareSDK.evmGetAddress(connectId, {
        bundle: paths.map((path) => ({
          path,
          /**
           * Search accounts not show detail at device.Only show on device when add accounts into wallet.
           */
          showOnOneKey: false,
        })),
      });
    } else {
      response = await HardwareSDK.evmGetAddress(connectId, {
        path: paths[0],
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
  console.error(response.payload);
  throw new OneKeyHardwareError({
    code: response.payload.code,
    message: response.payload.error,
  });
}
