import BigNumber from 'bignumber.js';

import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';

export const nativeTokenAddress = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const feeRecipient = '0xc1e92BD5d1aa6e5f5F299D0490BefD9D8E5a887a';
export const affiliateAddress = '0x4F5FC02bE49Bea15229041b87908148b04c14717';

export class TokenAmount {
  amount: BigNumber;

  decimals: BigNumber;

  value: BigNumber;

  base = new BigNumber(10);

  constructor(public token: Token, public typedValue: string) {
    this.value = new BigNumber(typedValue);
    this.decimals = new BigNumber(token.decimals);
    this.amount = this.base
      .exponentiatedBy(this.decimals)
      .multipliedBy(this.value);
  }

  toNumber() {
    return this.amount;
  }

  toFormat() {
    return this.toNumber().toFixed(0);
  }
}

export function getTokenAmountString(token: Token, amount: string) {
  const tokenAmount = new TokenAmount(token, amount);
  return tokenAmount.toFormat();
}

export function getTokenAmountValue(token: Token, amount: string) {
  const bn = new BigNumber(amount);
  const decimals = new BigNumber(token.decimals);
  const base = new BigNumber(10);
  const value = bn.dividedBy(base.exponentiatedBy(decimals));
  return value;
}

export function multiply(a: BigNumber.Value, b: BigNumber.Value): string {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return '0';
  }
  return num1.multipliedBy(num2).toFixed();
}

export function div(a: BigNumber.Value, b: BigNumber.Value): string {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return '0';
  }
  return num1.div(num2).toFixed();
}

export function plus(a: BigNumber.Value, b: BigNumber.Value): string {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return '0';
  }
  return num1.plus(num2).toFixed();
}

export function minus(a: BigNumber.Value, b: BigNumber.Value): string {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return '0';
  }
  return num1.minus(num2).toFixed();
}

export function gte(a: BigNumber.Value, b: BigNumber.Value): boolean {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return false;
  }
  return num1.gte(num2);
}

export function gt(a: BigNumber.Value, b: BigNumber.Value): boolean {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return false;
  }
  return num1.gt(num2);
}

export function lte(a: BigNumber.Value, b: BigNumber.Value): boolean {
  const num1 = new BigNumber(a);
  const num2 = new BigNumber(b);
  if (!BigNumber.isBigNumber(num1) || !BigNumber.isBigNumber(num2)) {
    return false;
  }
  return num1.lte(num2);
}

export function tokenBN(value: BigNumber.Value, decimals: BigNumber.Value) {
  return new BigNumber(10).exponentiatedBy(decimals).multipliedBy(value);
}

export function greaterThanZeroOrUndefined(value?: string) {
  if (!value || Number.isNaN(value)) {
    return undefined;
  }
  const num = Number(value);
  return num > 0 ? value : undefined;
}

export function formatAmount(value?: BigNumber.Value, precision = 4) {
  if (!value) {
    return '';
  }
  const bn = new BigNumber(value);
  if (bn.isNaN()) {
    return '';
  }
  return bn.decimalPlaces(precision).toFixed();
}

export function calculateRate(
  inDecimals: number,
  outDecimals: number,
  inNum: number | string,
  outNum: number | string,
): string {
  const result = new BigNumber(10 ** inDecimals)
    .multipliedBy(outNum)
    .div(10 ** outDecimals)
    .div(inNum);
  return result.toFixed();
}

export function getChainIdFromNetwork(network?: Network): string {
  const chainId = network?.extraInfo?.chainId;
  return network ? String(+chainId) : '';
}

export function getChainIdFromNetworkId(networdId: string) {
  return networdId.split('--')[1] ?? '';
}

export function isEvmNetworkId(networdId?: string) {
  if (!networdId) {
    return;
  }
  return networdId.split('--')[0] === 'evm';
}

export function getEvmTokenAddress(token: Token) {
  return token.tokenIdOnNetwork ? token.tokenIdOnNetwork : nativeTokenAddress;
}

export function calculateRange(
  values: { max?: BigNumber.Value; min?: BigNumber.Value }[],
): {
  max?: string;
  min?: string;
} {
  const maxValues = values.map((item) => item.max).filter(Boolean);
  const minValues = values.map((item) => item.min).filter(Boolean);
  return {
    max:
      maxValues.length > 0 ? BigNumber.max(...maxValues).toFixed() : undefined,
    min:
      minValues.length > 0 ? BigNumber.min(...minValues).toFixed() : undefined,
  };
}

export function stringifyTokens(a?: Token, b?: Token) {
  if (!a || !b) {
    return '';
  }
  const input = `input:${a.networkId}-${b.tokenIdOnNetwork}`;
  const output = `output:${a.networkId}-${b.tokenIdOnNetwork}`;
  return `${input}|${output} `;
}
