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
import OneKeyConnect, {
  ApplySettings,
  EthereumAddress,
  EthereumTransaction,
  Features,
} from '@onekeyfe/connect';

import { IMPL_EVM, SEPERATOR } from './constants';
import {
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from './errors';

/**
 * Get hardware wallet info
 * @returns {Promise<Features>}
 * @throws {OneKeyInternalError}
 * @throws {OneKeyHardwareError}
 */
export async function getFeatures(): Promise<Features> {
  let response;
  try {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    response = await OneKeyConnect.getFeatures();
  } catch (error: any) {
    throw new OneKeyHardwareError(error);
  }
  if (response.success) {
    return response.payload;
  }
  console.error(response.payload);
  throw new OneKeyHardwareError(`getFeatures: ${response.payload.error}`);
}

/**
 * Change the pin of the hardware wallet
 * @param remove {boolean}
 * @returns {Promise<void>}
 * @throws {OneKeyHardwareError}
 * @throws {OneKeyInternalError}
 */
export async function changePin(remove = false): Promise<void> {
  let response;
  try {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    response = await OneKeyConnect.changePin({ remove });
  } catch (error: any) {
    console.error(error);
    throw new OneKeyHardwareError(error);
  }
  if (response.success) {
    return;
  }
  console.error(response.payload);
  throw new OneKeyHardwareError(`changePin: ${response.payload.error}`);
}

/**
 * apply settings to the hardware wallet
 */
export async function applySettings(settings: ApplySettings): Promise<void> {
  let response;
  try {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    response = await OneKeyConnect.applySettings(settings);
  } catch (error: any) {
    console.error(error);
    throw new OneKeyHardwareError(error);
  }
  if (response.success) {
    return;
  }
  console.error(response.payload);
  throw new OneKeyHardwareError(`applySettings: ${response.payload.error}`);
}
/**
 * get Eth address from the hardware wallet with the specified derivation path
 * @param path drivation path
 * @param display show address on the screen
 * @returns
 * @throws {OneKeyHardwareError}
 */
export async function ethereumGetAddress(
  path: string | number[],
  display = false,
): Promise<string> {
  let response;
  try {
    response = await OneKeyConnect.ethereumGetAddress({
      path,
      showOnTrezor: display,
    });
  } catch (error: any) {
    console.error(error);
    throw new OneKeyHardwareError(error);
  }
  if (response.success) {
    return response.payload.address;
  }
  console.error(response.payload);
  throw new OneKeyHardwareError(
    `ethereumGetAddress: ${response.payload.error}`,
  );
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

/**
 * sign Eth transaction with the hardware wallet
 * @param params
 * @returns
 * @throws {OneKeyHardwareError}
 */
export async function ethereumSignTransaction(
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

  const txToSign: EthereumTransaction = {
    to,
    value,
    gasPrice: toBigIntHex(
      unsignedTx.feePricePerUnit || unsignedTx.payload.maxFeePerGas,
    ),
    gasLimit: toBigIntHex(unsignedTx.feeLimit),
    nonce: `0x${unsignedTx.nonce.toString(16)}`,
    data: unsignedTx.payload?.data || '0x',
    chainId: parseInt(chainId),
  };
  const tx: UnsignedTransaction = {
    to: txToSign.to,
    value: txToSign.value,
    gasPrice: txToSign.gasPrice,
    gasLimit: txToSign.gasLimit,
    nonce: parseInt(txToSign.nonce, 16),
    data: txToSign.data,
    chainId: txToSign.chainId,
  };

  try {
    response = await OneKeyConnect.ethereumSignTransaction({
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
  throw new OneKeyHardwareError(
    `ethereumSignTransaction: ${response.payload.error}`,
  );
}

export async function ethereumSignTxEIP1559(
  params: any,
): Promise<[Buffer, number]> {
  console.error('Not implemented', params);
  return Promise.reject(new Error('not implemented'));
}

export async function getXpubs(
  impl: string,
  paths: Array<string>,
  outputFormat: 'xpub' | 'pub' | 'address',
): Promise<Array<{ path: string; info: string }>> {
  if (impl !== IMPL_EVM || outputFormat !== 'address') {
    return Promise.resolve([]);
  }

  let response;
  try {
    if (paths.length > 1) {
      response = await OneKeyConnect.ethereumGetAddress({
        bundle: paths.map((path) => ({ path })),
      });
    } else {
      response = await OneKeyConnect.ethereumGetAddress({ path: paths[0] });
    }
  } catch (error: any) {
    console.error(error);
    throw new OneKeyHardwareError(error);
  }
  if (response.success) {
    if (paths.length > 1) {
      return (response.payload as EthereumAddress[]).map(
        ({ serializedPath, address }) => ({
          path: serializedPath,
          info: address,
        }),
      );
    }
    return [
      {
        path: (response.payload as EthereumAddress).serializedPath,
        info: (response.payload as EthereumAddress).address,
      },
    ];
  }
  console.error(response.payload);
  throw new OneKeyHardwareError(
    `ethereumGetAddress: ${response.payload.error}`,
  );
}

export async function signTransaction(
  networkId: string,
  path: string,
  unsignedTx: UnsignedTx,
): Promise<SignedTx> {
  const [impl, chainId] = networkId.split(SEPERATOR);
  if (impl === IMPL_EVM) {
    return ethereumSignTransaction(path, chainId, unsignedTx);
  }
  throw new NotImplemented();
}
