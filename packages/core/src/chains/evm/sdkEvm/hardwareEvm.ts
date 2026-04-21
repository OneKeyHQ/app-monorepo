/**
 * Pure helper for normalizing an EVM `encodedTx` into the shape the
 * hardware SDK expects + an `UnsignedTransaction` ready for
 * `buildSignedTxFromSignatureEvm`.
 *
 * Extracted verbatim from the duplicated logic that used to live inside
 * kit-bg's `KeyringHardware.signTransaction`. The CLI's hardware signer
 * now imports from here too, so both paths produce byte-identical
 * signed txs.
 *
 * Both callers invoke `buildSignedTxFromSignatureEvm` (in `./signatureEvm`)
 * directly on the returned `unsignedTx` — this module deliberately does
 * NOT wrap that step, keeping the seams identical to the pre-extraction
 * code.
 */

import { omit } from 'lodash';

import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import numberUtils from '@onekeyhq/shared/src/utils/numberUtils';

import type {
  IHardwareEvmTransaction,
  IHardwareEvmTransactionEIP1559,
} from './hardwareEvmTypes';
import type { UnsignedTransaction } from '@ethersproject/transactions';

/**
 * Input shape accepted by buildHardwareEvmTransaction.
 * Intentionally loose to accept both IEncodedTxEvm and CLI's
 * Record<string, unknown>. Unknown fields survive the `omit(_, 'from')`
 * spread so forward-compatible extras (e.g. `customData`) pass through
 * to the SDK exactly as the pre-extraction code did.
 */
export interface IBuildHardwareEvmTxInput {
  // nonce / gasLimit / chainId are optional at the type level because
  // IEncodedTxEvm declares them as optional too. At runtime they are
  // validated with checkIsDefined() before use and throw if missing.
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

/**
 * Normalize an encoded tx into the hardware SDK format + ethers
 * UnsignedTransaction. Mirrors the legacy kit-bg implementation exactly:
 * spread `encodedTx` (minus `from`) to preserve forward-compatible extras,
 * then override with the explicit hardware-protocol fields.
 */
export function buildHardwareEvmTransaction(
  encodedTx: IBuildHardwareEvmTxInput,
): {
  hwTransaction: IHardwareEvmTransaction | IHardwareEvmTransactionEIP1559;
  unsignedTx: UnsignedTransaction;
} {
  const nonce = numberUtils.numberToHex(checkIsDefined(encodedTx.nonce), {
    prefix0x: true,
  });
  const gasLimit = numberUtils.numberToHex(checkIsDefined(encodedTx.gasLimit), {
    prefix0x: true,
  });
  const chainId = Number(encodedTx.chainId);
  const value = encodedTx.value ?? '0x0';
  const data = encodedTx.data ?? '0x';
  const to = encodedTx.to ?? '';

  const isEip1559 = encodedTx.maxFeePerGas || encodedTx.maxPriorityFeePerGas;

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

  // Build UnsignedTransaction for ethers RLP serialization
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
