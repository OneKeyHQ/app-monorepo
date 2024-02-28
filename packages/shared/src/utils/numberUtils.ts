import BigNumber from 'bignumber.js';

import { check } from '@onekeyhq/shared/src/utils/assertUtils';

import { appLocale } from '../locale/appLocale';

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

export interface IDisplayNumber {
  formattedValue: string;
  meta: {
    value: string;
    unit?: string;
    leadingZeros?: number;
    leading?: string;
    currency?: string;
    symbol?: string;
  };
}

const countLeadingZeroDecimals = (x: BigNumber) => {
  const counts = -Math.floor(Math.log10(x.toNumber()) + 1);
  return counts > 0 ? counts : 0;
};

const removeDecimalPaddingZero = (x: string) => x.replace(/(\.\d+?)0*$/, '$1');

const formatLocalNumber = (value: string) =>
  appLocale.intl.formatNumber(Number(value), { maximumFractionDigits: 20 });

const formatNumber = (value: string, isRemoveDecimalPaddingZero = false) =>
  isRemoveDecimalPaddingZero
    ? formatLocalNumber(removeDecimalPaddingZero(value))
    : formatLocalNumber(value);

// format Balance/Amount
export function formatBalance(value: string): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: '0', meta: { value } };
  }
  if (val.gte(1)) {
    if (val.gte(10e14)) {
      return {
        formattedValue: formatNumber(val.div(10e14).toFixed(4), true),
        meta: {
          value,
          unit: 'Q',
        },
      };
    }

    if (val.gte(10e11)) {
      return {
        formattedValue: formatNumber(val.div(10e11).toFixed(4), true),
        meta: {
          value,
          unit: 'T',
        },
      };
    }

    if (val.gte(10e8)) {
      return {
        formattedValue: formatNumber(val.div(10e8).toFixed(4), true),
        meta: {
          value,
          unit: 'B',
        },
      };
    }
    return {
      formattedValue: formatNumber(val.toFixed(4), true),
      meta: { value },
    };
  }

  const zeros = countLeadingZeroDecimals(val);
  return {
    formattedValue: formatNumber(val.toFixed(4 + zeros), true),
    meta: {
      value,
      leadingZeros: countLeadingZeroDecimals(val),
    },
  };
}

// Price/USD
export function formatPrice(value: string, currency: string): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: '0', meta: { value, currency } };
  }
  if (val.gte(1)) {
    return { formattedValue: val.toFixed(2), meta: { value, currency } };
  }

  const zeros = countLeadingZeroDecimals(val);

  return {
    formattedValue: formatNumber(val.toFixed(4 + zeros), true),
    meta: { value, currency, leadingZeros: zeros },
  };
}

// PriceChange
export function formatPriceChange(value: string): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: '0.00', meta: { value, symbol: '%' } };
  }
  return { formattedValue: val.toFixed(2), meta: { value, symbol: '%' } };
}

// DeFi Value
export function formatDeFiValue(
  value: string,
  currency: string,
): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.lt(0.01)) {
    return { formattedValue: '0.01', meta: { value, leading: '<', currency } };
  }
  return {
    formattedValue: val.toFixed(2),
    meta: { value, leading: '%', currency },
  };
}

// FDV / MarketCap / Volume / Liquidty / TVL / TokenSupply
export function formatFDV(value: string): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return {
      formattedValue: '0',
      meta: { value },
    };
  }

  if (val.gte(10e11)) {
    return {
      formattedValue: formatNumber(val.div(10e11).toFixed(2), true),
      meta: { value, unit: 'T' },
    };
  }
  if (val.gte(10e8)) {
    return {
      formattedValue: formatNumber(val.div(10e8).toFixed(2), true),
      meta: { value, unit: 'B' },
    };
  }
  if (val.gte(10e5)) {
    return {
      formattedValue: formatNumber(val.div(10e6).toFixed(2), true),
      meta: { value, unit: 'M' },
    };
  }
  if (val.gte(10e3)) {
    return {
      formattedValue: formatNumber(val.div(10e3).toFixed(2), true),
      meta: { value, unit: 'K' },
    };
  }
  return {
    formattedValue: formatNumber(val.toFixed(2), true),
    meta: { value },
  };
}

export const formatDisplayNumber = (value: IDisplayNumber) => {
  const {
    formattedValue,
    meta: { leading, leadingZeros, currency, unit, symbol },
  } = value;
  const strings = [];
  if (leading) {
    strings.push(leading);
  }
  if (currency) {
    strings.push(currency);
  }
  if (leadingZeros && leadingZeros > 4) {
    strings.push('0.0');
    strings.push({ value: leadingZeros, type: 'sub' });
    strings.push(formattedValue.slice(leadingZeros + 2));
  } else {
    strings.push(formattedValue);
  }
  if (unit) {
    strings.push(unit);
  }
  if (symbol) {
    strings.push(symbol);
  }
  return leadingZeros && leadingZeros > 4 ? strings : strings.join('');
};
