import {
  type Network,
  type Psbt,
  Transaction,
  address as bitcoinjsAddress,
} from 'bitcoinjs-lib';

import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { ITxInputToSign } from '@onekeyhq/core/src/types/coreTypesTx';

import { AppError, ERROR_CODES } from '../../errors';

// Relative cap (5%) with an absolute floor so small transfers aren't rejected
// by realistic fees. 200_000 sats ≈ a generous BTC mainnet fee budget.
const MAX_FEE_BASIS_POINTS = 500n;
const MAX_FEE_FLOOR_SATS = 200_000n;

export interface IBtcSpendDescriptor {
  ourInputSum: bigint;
  ourOutputSum: bigint;
  externalOutputSum: bigint;
  totalInputSum: bigint;
  totalOutputSum: bigint;
  fee: bigint;
}

export interface IAssertSpendParams {
  expectedSpendSats: bigint;
  maxFeeSats?: bigint;
}

function toBigInt(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return value;
  return BigInt(value);
}

function defaultMaxFeeSats(spendSats: bigint): bigint {
  const ratioBased = (spendSats * MAX_FEE_BASIS_POINTS) / 10_000n;
  return ratioBased > MAX_FEE_FLOOR_SATS ? ratioBased : MAX_FEE_FLOOR_SATS;
}

function decodeAddressFromScript(
  script: Buffer,
  network: Network,
): string | null {
  try {
    return bitcoinjsAddress.fromOutputScript(script, network);
  } catch {
    return null;
  }
}

function getPsbtInputScriptAndValue(
  psbt: Psbt,
  index: number,
): { script: Buffer; value: bigint } {
  const psbtInput = psbt.data.inputs[index];
  if (psbtInput?.witnessUtxo) {
    return {
      script: Buffer.from(psbtInput.witnessUtxo.script),
      value: BigInt(psbtInput.witnessUtxo.value),
    };
  }
  if (psbtInput?.nonWitnessUtxo) {
    const prevTx = Transaction.fromBuffer(
      Buffer.from(psbtInput.nonWitnessUtxo),
    );
    const prevoutIndex = psbt.txInputs[index]?.index;
    const prevOut =
      prevoutIndex !== undefined ? prevTx.outs[prevoutIndex] : undefined;
    if (prevOut) {
      return {
        script: Buffer.from(prevOut.script),
        value: BigInt(prevOut.value),
      };
    }
  }
  throw new AppError(
    ERROR_CODES.BIZ_SWAP_FAILED.code,
    `BTC PSBT input ${index} is missing both witnessUtxo and nonWitnessUtxo`,
    'Refresh the quote — refusing to sign incomplete PSBT',
  );
}

export function describePsbtSpend(
  psbt: Psbt,
  ourAddress: string,
  network: Network,
): IBtcSpendDescriptor {
  let ourInputSum = 0n;
  let totalInputSum = 0n;

  for (let i = 0; i < psbt.data.inputs.length; i += 1) {
    const { script, value } = getPsbtInputScriptAndValue(psbt, i);
    totalInputSum += value;
    if (decodeAddressFromScript(script, network) === ourAddress) {
      ourInputSum += value;
    }
  }

  let ourOutputSum = 0n;
  let externalOutputSum = 0n;
  let totalOutputSum = 0n;

  for (const txOutput of psbt.txOutputs) {
    const value = BigInt(txOutput.value);
    totalOutputSum += value;
    if (txOutput.address === ourAddress) {
      ourOutputSum += value;
    } else {
      externalOutputSum += value;
    }
  }

  return {
    ourInputSum,
    ourOutputSum,
    externalOutputSum,
    totalInputSum,
    totalOutputSum,
    fee: totalInputSum - totalOutputSum,
  };
}

export function describeEncodedTxSpend(
  encodedTx: IEncodedTxBtc,
  ourAddress: string,
): IBtcSpendDescriptor {
  let ourInputSum = 0n;
  let totalInputSum = 0n;

  for (const input of encodedTx.inputs ?? []) {
    const value = toBigInt(input.value);
    totalInputSum += value;
    if (input.address === ourAddress) {
      ourInputSum += value;
    }
  }

  let ourOutputSum = 0n;
  let externalOutputSum = 0n;
  let totalOutputSum = 0n;

  for (const output of encodedTx.outputs ?? []) {
    // OP_RETURN outputs carry an empty address with value '0'; skip them so
    // they don't inflate externalOutputSum.
    if (output.address) {
      const value = toBigInt(output.value);
      totalOutputSum += value;
      if (output.address === ourAddress) {
        ourOutputSum += value;
      } else {
        externalOutputSum += value;
      }
    }
  }

  return {
    ourInputSum,
    ourOutputSum,
    externalOutputSum,
    totalInputSum,
    totalOutputSum,
    fee: totalInputSum - totalOutputSum,
  };
}

/**
 * Independent local validation of a BTC spend, regardless of whether the tx
 * was constructed locally or returned by a swap provider.
 *
 * Hardware signers already protect "is this private key really mine"
 * (path-based derivation), so this fn only enforces the *amount* invariants:
 *   - some input belongs to us (otherwise we'd sign nothing useful)
 *   - net spend (our inputs − our change) ≥ expected amount
 *   - the implied fee ≤ a safety cap (default 5% of expected, floor 200k sats)
 *   - no external output line item exceeds the expected spend (defense in depth)
 */
export function assertBtcSpendIsSafe(
  descriptor: IBtcSpendDescriptor,
  params: IAssertSpendParams,
): void {
  const { expectedSpendSats } = params;
  const maxFeeSats = params.maxFeeSats ?? defaultMaxFeeSats(expectedSpendSats);

  if (descriptor.ourInputSum === 0n) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      'BTC tx has no inputs from the current wallet — refusing to sign',
      'Run "onekey swap build" again with the correct address type',
    );
  }

  const netSpend = descriptor.ourInputSum - descriptor.ourOutputSum;
  if (netSpend < expectedSpendSats) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      `BTC tx underspends: net ${netSpend} sats < expected ${expectedSpendSats} sats`,
      'Refresh the quote — refusing to sign mismatched tx',
    );
  }

  const fee = netSpend - expectedSpendSats;
  if (fee > maxFeeSats) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      `BTC tx fee ${fee} sats exceeds safety cap ${maxFeeSats} sats (expected ${expectedSpendSats} sats spend)`,
      'Refresh the quote or pass a lower --fee-rate',
    );
  }

  if (descriptor.externalOutputSum > expectedSpendSats) {
    throw new AppError(
      ERROR_CODES.BIZ_SWAP_FAILED.code,
      `BTC tx external output sum ${descriptor.externalOutputSum} sats exceeds expected ${expectedSpendSats} sats`,
      'Refresh the quote — PSBT spends more than authorised',
    );
  }
}

/**
 * Restrict inputsToSign to those whose prevout script decodes to ourAddress.
 * `getInputsToSignFromPsbt({ isBtcWalletProvider: true })` may include any
 * unsigned input — this strict filter prevents the CLI from attempting to
 * sign inputs that don't belong to the current wallet address.
 */
export function filterPsbtInputsToOwnedOnly<T extends ITxInputToSign>(
  inputsToSign: T[],
  psbt: Psbt,
  ourAddress: string,
  network: Network,
): T[] {
  return inputsToSign.filter((item) => {
    let script: Buffer | undefined;
    try {
      script = getPsbtInputScriptAndValue(psbt, item.index).script;
    } catch {
      return false;
    }
    return decodeAddressFromScript(script, network) === ourAddress;
  });
}
