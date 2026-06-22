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

import type { IEvmEthereumDefinitions, IEvmPaymentRequest } from '../types';
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
  gasPrice: string; // 0x-prefixed hex
  txType?: number;
  accessList?: Array<{ address: string; storageKeys: string[] }>;
  maxFeePerGas: undefined;
  maxPriorityFeePerGas: undefined;
  paymentRequest?: IEvmPaymentRequest;
  ethereumDefinitions?: IEvmEthereumDefinitions;
}

export interface IHardwareEvmTransactionEIP1559 {
  to: string;
  value: string;
  data: string;
  chainId: number;
  nonce: string; // 0x-prefixed hex
  gasLimit: string; // 0x-prefixed hex
  gasPrice: undefined;
  maxFeePerGas: string; // 0x-prefixed hex
  maxPriorityFeePerGas: string; // 0x-prefixed hex
  accessList?: Array<{ address: string; storageKeys: string[] }>;
  paymentRequest?: IEvmPaymentRequest;
  ethereumDefinitions?: IEvmEthereumDefinitions;
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
  txType?: number;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  accessList?: Array<{ address: string; storageKeys: string[] }>;
  paymentRequest?: IEvmPaymentRequest;
  ethereumDefinitions?: IEvmEthereumDefinitions;
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
  const gasPrice = encodedTx.gasPrice
    ? numberUtils.numberToHex(encodedTx.gasPrice, { prefix0x: true })
    : undefined;
  const maxFeePerGas = encodedTx.maxFeePerGas
    ? numberUtils.numberToHex(encodedTx.maxFeePerGas, { prefix0x: true })
    : undefined;
  const maxPriorityFeePerGas = encodedTx.maxPriorityFeePerGas
    ? numberUtils.numberToHex(encodedTx.maxPriorityFeePerGas, {
        prefix0x: true,
      })
    : undefined;

  const isEip1559 = maxFeePerGas || maxPriorityFeePerGas;
  let txType: number | undefined;
  if (typeof encodedTx.txType === 'number') {
    txType = encodedTx.txType;
  } else if (encodedTx.accessList) {
    txType = 1;
  }
  const isEip2930 = !isEip1559 && (txType === 1 || !!encodedTx.accessList);

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
      maxFeePerGas: checkIsDefined(maxFeePerGas),
      maxPriorityFeePerGas: checkIsDefined(maxPriorityFeePerGas),
    } as IHardwareEvmTransactionEIP1559;
  } else {
    hwTransaction = {
      ...extras,
      to,
      value,
      data,
      chainId,
      nonce,
      gasPrice: checkIsDefined(gasPrice),
      gasLimit,
      maxFeePerGas: undefined,
      maxPriorityFeePerGas: undefined,
    } as IHardwareEvmTransaction;
  }

  // Build UnsignedTransaction for ethers RLP serialization.
  const unsignedTx: UnsignedTransaction = {
    to: hwTransaction.to || undefined,
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
  } else if (isEip2930) {
    unsignedTx.type = txType ?? 1;
    unsignedTx.accessList = (
      hwTransaction as IHardwareEvmTransaction
    ).accessList;
  }

  return { hwTransaction, unsignedTx };
}
