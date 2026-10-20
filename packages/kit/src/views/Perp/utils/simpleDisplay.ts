import BigNumber from 'bignumber.js';

export function simpleUsd(value: BigNumber.Value | null | undefined) {
  const number = new BigNumber(value ?? '');
  return number.isFinite()
    ? `${number.lt(0) ? '-' : ''}$${number.abs().toFormat(2)}`
    : '--';
}

export function simplePrice(value: BigNumber.Value | null | undefined) {
  const number = new BigNumber(value ?? '');
  return number.isFinite()
    ? `$${new BigNumber(number.toPrecision(6)).toFormat()}`
    : '--';
}
