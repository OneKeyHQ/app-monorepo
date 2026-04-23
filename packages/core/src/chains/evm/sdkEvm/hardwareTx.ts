/**
 * Normalize an EVM `encodedTx` into the shape the hardware SDK expects,
 * plus an ethers `UnsignedTransaction` ready for
 * `buildSignedTxFromSignatureEvm`. Shared by kit-bg's `KeyringHardware`
 * and the CLI's `SignerHardware` so both produce byte-identical signed
 * txs.
 */

import { omit } from 'lodash';

import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import numberUtils from '@onekeyhq/shared/src/utils/numberUtils';

import type { UnsignedTransaction } from '@ethersproject/transactions';

// Hardware SDK transaction shapes (mirror hd-core's EVMTransaction /
// EVMTransactionEIP1559). Defined here rather than imported from hd-core
// so the CLI's CJS bundle doesn't have to pull in the SDK's typings.
export interface IHardwareEvmTransaction {
  to: string;
  value: string;
  data: string;
  chainId: number;
  nonce: string; // 0x-prefixed hex
  gasLimit: string; // 0x-prefixed hex
  gasPrice: string;
  maxFeePerGas: undefined;
  maxPriorityFeePerGas: undefined;
}

export interface IHardwareEvmTransactionEIP1559 {
  to: string;
  value: string;
  data: string;
  chainId: number;
  nonce: string; // 0x-prefixed hex
  gasLimit: string; // 0x-prefixed hex
  gasPrice: undefined;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  accessList?: Array<{ address: string; storageKeys: string[] }>;
}

/**
 * Loose input shape: accepts both `IEncodedTxEvm` and the CLI's
 * `Record<string, unknown>` variant. Required fields are validated at
 * runtime via `checkIsDefined` below — optional on the type so callers
 * can pass partial records without upstream type gymnastics.
 */
export interface IBuildHardwareEvmTxInput {
  nonce?: string | number;
  gasLimit?: string | number;
  gas?: string | number;
  chainId?: string | number;
  value?: string;
  data?: string;
  to?: string;
  from?: string;
  customData?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  accessList?: Array<{ address: string; storageKeys: string[] }>;
  [key: string]: unknown;
}

export function buildHardwareEvmTransaction(
  encodedTx: IBuildHardwareEvmTxInput,
): {
  hwTransaction: IHardwareEvmTransaction | IHardwareEvmTransactionEIP1559;
  unsignedTx: UnsignedTransaction;
} {
  const nonce = numberUtils.numberToHex(checkIsDefined(encodedTx.nonce), {
    prefix0x: true,
  });
  const gasLimit = numberUtils.numberToHex(
    checkIsDefined(encodedTx.gasLimit ?? encodedTx.gas),
    { prefix0x: true },
  );
  const chainId = Number(encodedTx.chainId);
  const value = encodedTx.value ?? '0x0';
  const data = encodedTx.data ?? '0x';
  const to = encodedTx.to ?? '';

  const isEip1559 = encodedTx.maxFeePerGas || encodedTx.maxPriorityFeePerGas;

  // Spread extras (e.g. `customData`) minus `from` to preserve the
  // pre-extraction kit-bg behavior.
  const extras = omit(encodedTx, 'from');

  let hwTransaction: IHardwareEvmTransaction | IHardwareEvmTransactionEIP1559;

  if (isEip1559) {
    hwTransaction = {
      ...extras,
      to,
      value,
      data,
      chainId,
      nonce,
      gasPrice: undefined,
      gasLimit,
      maxFeePerGas: checkIsDefined(encodedTx.maxFeePerGas),
      maxPriorityFeePerGas: checkIsDefined(encodedTx.maxPriorityFeePerGas),
    } as IHardwareEvmTransactionEIP1559;
  } else {
    hwTransaction = {
      ...extras,
      to,
      value,
      data,
      chainId,
      nonce,
      gasPrice: checkIsDefined(encodedTx.gasPrice),
      gasLimit,
      maxFeePerGas: undefined,
      maxPriorityFeePerGas: undefined,
    } as IHardwareEvmTransaction;
  }

  // Build UnsignedTransaction for ethers RLP serialization.
  const unsignedTx: UnsignedTransaction = {
    to: hwTransaction.to,
    gasPrice: hwTransaction.gasPrice,
    gasLimit: hwTransaction.gasLimit,
    nonce: parseInt(hwTransaction.nonce, 16),
    data: hwTransaction.data,
    value: hwTransaction.value,
    chainId: hwTransaction.chainId,
  };

  if (isEip1559) {
    unsignedTx.type = 2;
    unsignedTx.maxFeePerGas = hwTransaction.maxFeePerGas ?? undefined;
    unsignedTx.maxPriorityFeePerGas =
      hwTransaction.maxPriorityFeePerGas ?? undefined;

    if ((hwTransaction as IHardwareEvmTransactionEIP1559).accessList) {
      unsignedTx.accessList = (
        hwTransaction as IHardwareEvmTransactionEIP1559
      ).accessList;
    }
  }

  return { hwTransaction, unsignedTx };
}
