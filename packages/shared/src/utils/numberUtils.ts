import BigNumber from 'bignumber.js';

import { check } from '@onekeyhq/shared/src/utils/assertUtils';

import hexUtils from './hexUtils';

const toBigIntHex = (value: BigNumber): string => {
  let hexStr = value.integerValue().toString(16);

  hexStr = `0x${hexStr}`;
  return hexStr;
};

const fromBigIntHex = (value: string): BigNumber => {
  check(value && value.startsWith('0x'), `Invalid hex string. value: ${value}`);
  return new BigNumber(value).integerValue();
};

function numberToHex(
  number: string | number,
  { prefix0x = true }: { prefix0x?: boolean } = {},
): string {
  let val = new BigNumber(number).toString(16);

  if (prefix0x) {
    val = hexUtils.addHexPrefix(val);
  }
  return val;
}

function hexToDecimal(hex: string): string {
  return new BigNumber(hexUtils.addHexPrefix(hex)).toFixed();
}

export default { numberToHex, hexToDecimal };

export { fromBigIntHex, toBigIntHex };

const countLeadingZeroDecimals = (x: BigNumber) =>
  -Math.floor(Math.log10(x.toNumber()) + 1);

const removeDecimalPaddingZero = (x: string) => x.replace(/(\.\d+?)0*$/, '$1');

export interface IDisplayNumber {
  value: string;
  unit?: string;
  leadingZeros?: number;
  leading?: string;
  currency?: string;
  symbol?: string;
}

// format Balance/Amount
export function formatBalance(value: string): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { value: '0' };
  }
  if (val.gte(1)) {
    if (val.gte(10e15)) {
      return {
        value: removeDecimalPaddingZero(val.div(10e15).toFixed(2)),
        unit: 'Q',
      };
    }

    if (val.gte(10e12)) {
      return {
        value: removeDecimalPaddingZero(val.div(10e12).toFixed(2)),
        unit: 'T',
      };
    }

    if (val.gte(10e9)) {
      return {
        value: removeDecimalPaddingZero(val.div(10e9).toFixed(2)),
        unit: 'B',
      };
    }
    return { value: removeDecimalPaddingZero(val.toFixed(4)) };
  }

  const zeros = countLeadingZeroDecimals(val);
  return {
    value: removeDecimalPaddingZero(val.toFixed(4 + zeros)),
    leadingZeros: countLeadingZeroDecimals(val),
  };
}

// Price/USD
export function formatPrice(value: string, currency: string): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { value: '0', currency };
  }
  if (val.gte(1)) {
    return { value: val.toFixed(2), currency };
  }

  const zeros = countLeadingZeroDecimals(val);
  return {
    value: removeDecimalPaddingZero(val.toFixed(4 + zeros)),
    currency,
    leadingZeros: countLeadingZeroDecimals(val),
  };
}

// PriceChange
export function formatPriceChange(value: string): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { value: '0.00', symbol: '%' };
  }
  return { value: val.toFixed(2), symbol: '%' };
}

// DeFi Value
export function formatDeFiValue(
  value: string,
  currency: string,
): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.lt(0.01)) {
    return { value: '0.01', leading: '<', currency };
  }
  return { value: val.toFixed(2), symbol: '%', currency };
}

// FDV / MarketCap / Volume / Liquidty / TVL / TokenSupply
export function formatFDV(value: string): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { value: '0' };
  }

  if (val.gte(10e12)) {
    return {
      value: removeDecimalPaddingZero(val.div(10e12).toFixed(2)),
      unit: 'T',
    };
  }
  if (val.gte(10e12)) {
    return {
      value: removeDecimalPaddingZero(val.div(10e12).toFixed(2)),
      unit: 'T',
    };
  }
  if (val.gte(10e9)) {
    return {
      value: removeDecimalPaddingZero(val.div(10e9).toFixed(2)),
      unit: 'B',
    };
  }
  if (val.gte(10e6)) {
    return {
      value: removeDecimalPaddingZero(val.div(10e6).toFixed(2)),
      unit: 'M',
    };
  }
  if (val.gte(10e3)) {
    return {
      value: removeDecimalPaddingZero(val.div(10e3).toFixed(2)),
      unit: 'K',
    };
  }
  return { value: removeDecimalPaddingZero(val.toFixed(2)) };
}
