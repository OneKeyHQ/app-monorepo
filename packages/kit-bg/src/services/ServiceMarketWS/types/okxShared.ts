import BigNumber from 'bignumber.js';

export const OKX_DATA_SOURCE = 'okx';

const zeroBN = new BigNumber(0);

type IBigNumberInput = BigNumber.Value | null | undefined;

export const toBigNumber = (value: IBigNumberInput) => {
  const bn = new BigNumber(value ?? 0);
  return bn.isFinite() ? bn : zeroBN;
};

export const toNumber = (value: IBigNumberInput): number => {
  const bn = toBigNumber(value);
  return bn.isFinite() ? bn.toNumber() : 0;
};

export const normalizeTimestamp = (value: IBigNumberInput): number => {
  const timestamp = toNumber(value);
  if (timestamp > 1_000_000_000_000) {
    return Math.floor(timestamp / 1000);
  }
  return Math.floor(timestamp);
};
