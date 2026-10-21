import BigNumber from 'bignumber.js';

import sdkStarknet from '@onekeyhq/core/src/chains/starknet/sdkStarknet';
import type {
  IStarknetCall,
  IStarknetResourceBounds,
  IStarknetResourceBoundsItem,
} from '@onekeyhq/core/src/chains/starknet/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IFeeStarknet } from '@onekeyhq/shared/types/fee';

import {
  ERC20_ENTRYPOINT,
  RESOURCE_BOUNDS_MULTIPLIER,
} from './sdkStarknet/consts';

const U128_SHIFT = BigInt(128);
const U128_MASK = (BigInt(1) << U128_SHIFT) - BigInt(1);

export function toHexFelt(value: bigint | string | number): string {
  return `0x${BigInt(value).toString(16)}`;
}

export function hexToDecimalString(value: string): string {
  return BigInt(value).toString(10);
}

/**
 * Starknet u256 crosses the wire as two felts, low first. Both legs are hex.
 */
export function u256ToDecimalString(low: string, high: string): string {
  return ((BigInt(high) << U128_SHIFT) + BigInt(low)).toString(10);
}

/** Inverse of u256ToDecimalString: a base-unit amount into [low, high] hex. */
export function decimalStringToU256(amount: string): [string, string] {
  const normalized = new BigNumber(amount);
  if (!normalized.isFinite() || normalized.isNegative()) {
    throw new OneKeyLocalError(`Invalid u256 amount: ${amount}`);
  }
  if (!normalized.isInteger()) {
    throw new OneKeyLocalError(
      `u256 amount must already be in base units: ${amount}`,
    );
  }
  const value = BigInt(normalized.toFixed(0));
  return [toHexFelt(value & U128_MASK), toHexFelt(value >> U128_SHIFT)];
}

/**
 * 0x + 64 lowercase hex. Starknet nodes return unpadded felts while this app
 * compares addresses as plain strings, so every address crossing a boundary
 * goes through here.
 */
export function normalizeStarknetAddress(address: string): string {
  return sdkStarknet.normalizeAddress(address);
}

export function isValidStarknetAddress(address: string): boolean {
  try {
    normalizeStarknetAddress(address);
    return true;
  } catch {
    return false;
  }
}

/** Token addresses are felts too, and the same padding rules apply. */
export function normalizeTokenAddress(address: string): string {
  return normalizeStarknetAddress(address);
}

function padBound(value: string, multiplier: number): string {
  // floor(value * multiplier), matching starknet.js's integer percentage math
  const padded = new BigNumber(hexToDecimalString(value))
    .multipliedBy(multiplier)
    .integerValue(BigNumber.ROUND_FLOOR);
  return toHexFelt(BigInt(padded.toFixed(0)));
}

type IStarknetFeeEstimateLike = {
  l1_gas_consumed: string;
  l1_gas_price: string;
  l2_gas_consumed: string;
  l2_gas_price: string;
  l1_data_gas_consumed: string;
  l1_data_gas_price: string;
};

/**
 * Turn a starknet_estimateFee element into the resource bounds that get signed,
 * padding every value by the shared multiplier.
 */
export function toResourceBounds(
  estimate: IStarknetFeeEstimateLike,
  multiplier: number = RESOURCE_BOUNDS_MULTIPLIER,
): IStarknetResourceBounds {
  return {
    l1_gas: {
      max_amount: padBound(estimate.l1_gas_consumed, multiplier),
      max_price_per_unit: padBound(estimate.l1_gas_price, multiplier),
    },
    l2_gas: {
      max_amount: padBound(estimate.l2_gas_consumed, multiplier),
      max_price_per_unit: padBound(estimate.l2_gas_price, multiplier),
    },
    l1_data_gas: {
      max_amount: padBound(estimate.l1_data_gas_consumed, multiplier),
      max_price_per_unit: padBound(estimate.l1_data_gas_price, multiplier),
    },
  };
}

export function zeroResourceBounds(): IStarknetResourceBounds {
  const zero: IStarknetResourceBoundsItem = {
    max_amount: '0x0',
    max_price_per_unit: '0x0',
  };
  return { l1_gas: { ...zero }, l2_gas: { ...zero }, l1_data_gas: { ...zero } };
}

function boundToDecimal(item: IStarknetResourceBoundsItem) {
  return {
    maxAmount: hexToDecimalString(item.max_amount),
    maxPricePerUnit: hexToDecimalString(item.max_price_per_unit),
  };
}

/** Resource bounds as the fee UI wants them: decimal strings in FRI. */
export function resourceBoundsToFee(
  bounds: IStarknetResourceBounds,
): Omit<IFeeStarknet, 'deployAccountFee'> {
  return {
    l1Gas: boundToDecimal(bounds.l1_gas),
    l2Gas: boundToDecimal(bounds.l2_gas),
    l1DataGas: boundToDecimal(bounds.l1_data_gas),
  };
}

/** Worst-case FRI these bounds authorize: sum of amount * price per resource. */
export function sumResourceBounds(bounds: IStarknetResourceBounds): string {
  return [bounds.l1_gas, bounds.l2_gas, bounds.l1_data_gas]
    .reduce(
      (total, item) =>
        total.plus(
          new BigNumber(hexToDecimalString(item.max_amount)).multipliedBy(
            hexToDecimalString(item.max_price_per_unit),
          ),
        ),
      new BigNumber(0),
    )
    .toFixed(0);
}

function feltToUtf8(felt: string): string {
  const value = BigInt(felt);
  if (value === BigInt(0)) {
    return '';
  }
  const hex = value.toString(16);
  return Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex').toString('utf8');
}

/**
 * ERC-20 name/symbol come back in one of two Cairo encodings: a single
 * felt252 short string on older contracts, or a ByteArray
 * `[fullWordCount, ...fullWords, pendingWord, pendingWordLength]` on Cairo 1
 * ones such as STRK and ETH. Both are seen on mainnet today.
 */
export function decodeCairoString(felts: string[]): string {
  if (felts.length === 0) {
    return '';
  }
  if (felts.length === 1) {
    return feltToUtf8(felts[0]);
  }
  const fullWordCount = Number(BigInt(felts[0]));
  if (
    !Number.isSafeInteger(fullWordCount) ||
    felts.length !== fullWordCount + 3
  ) {
    // not a ByteArray after all; fall back to reading it as a short string
    return feltToUtf8(felts[0]);
  }
  const fullWords = felts
    .slice(1, 1 + fullWordCount)
    .map((word) => feltToUtf8(word))
    .join('');
  const pendingWordLength = Number(BigInt(felts[felts.length - 1]));
  const pendingWord = pendingWordLength
    ? feltToUtf8(felts[felts.length - 2])
    : '';
  return `${fullWords}${pendingWord}`;
}

export function buildErc20TransferCall(params: {
  tokenAddress: string;
  to: string;
  amount: string;
}): IStarknetCall {
  const [low, high] = decimalStringToU256(params.amount);
  return {
    contractAddress: normalizeTokenAddress(params.tokenAddress),
    entrypoint: ERC20_ENTRYPOINT.transfer,
    calldata: [normalizeStarknetAddress(params.to), low, high],
  };
}

/**
 * STRK20 needs this: `apply_actions` pulls its STRK fee from the caller before
 * doing anything, so the privacy transaction has to carry an allowance for the
 * pool alongside the actions themselves.
 */
export function buildErc20ApproveCall(params: {
  tokenAddress: string;
  spender: string;
  amount: string;
}): IStarknetCall {
  const [low, high] = decimalStringToU256(params.amount);
  return {
    contractAddress: normalizeTokenAddress(params.tokenAddress),
    entrypoint: ERC20_ENTRYPOINT.approve,
    calldata: [normalizeStarknetAddress(params.spender), low, high],
  };
}

/**
 * Pull the JSON-RPC error code out of whatever the transport threw.
 * JsonRPCResponseError carries the whole `{jsonrpc, id, error}` body on
 * `.response`; anything else is treated as "no code".
 */
export function parseRpcErrorCode(error: unknown): number | undefined {
  const candidates: unknown[] = [
    error,
    (error as { response?: unknown })?.response,
    (error as { error?: unknown })?.error,
  ];
  for (const candidate of candidates) {
    const inner = (candidate as { error?: { code?: unknown } })?.error;
    if (typeof inner?.code === 'number') {
      return inner.code;
    }
    const code = (candidate as { code?: unknown })?.code;
    if (typeof code === 'number') {
      return code;
    }
  }
  return undefined;
}
