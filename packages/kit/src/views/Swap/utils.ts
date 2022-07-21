import BigNumber from 'bignumber.js';

import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { enabledChainIds } from './config';

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
    return this.toNumber().toFixed();
  }
}

export function getTokenAmountString(token: Token, amount: string) {
  const tokenAmount = new TokenAmount(token, amount);
  return tokenAmount.toFormat();
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

export function getChainIdFromNetwork(network?: Network): string {
  const chainId = network?.extraInfo?.chainId;
  return network ? String(+chainId) : '';
}

export function getChainIdFromNetworkId(networdId: string) {
  return networdId.split('--')[1] ?? '';
}

export function getEvmTokenAddress(token: Token) {
  return token.tokenIdOnNetwork ? token.tokenIdOnNetwork : nativeTokenAddress;
}

export function isNetworkEnabled(
  network: Network,
  whitelist: string[] = [],
): boolean {
  if (whitelist.includes(network.id)) {
    return true;
  }
  const chainId = getChainIdFromNetworkId(network.id);
  return (
    network.impl === 'evm' &&
    network.enabled &&
    enabledChainIds.includes(chainId)
  );
}
