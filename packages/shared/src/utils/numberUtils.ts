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

const stripTrailingZero = (x: string) =>
  x.replace(/(\.[0-9]*[1-9])0+$|\.0*$/, '$1');

const formatLocalNumber = (
  value: BigNumber | string,
  digits = 2,
  keepTrailingZeros = false,
  keepDigits = false,
) => {
  const string = typeof value === 'string' ? value : value.toFixed();
  let [integerPart, decimalPart] = string.split('.');
  if (!decimalPart && keepDigits) {
    decimalPart = '0';
  }
  const decimal = decimalPart ? `.${decimalPart}` : '';

  const integer = `${
    integerPart === '-0' ? '-' : ''
  }${appLocale.intl.formatNumber(BigInt(integerPart))}`;

  const result = `${integer}${
    decimal
      ? appLocale.intl
          .formatNumber(Number.parseFloat(decimal), {
            maximumFractionDigits: digits,
            minimumFractionDigits: digits,
          })
          .slice(1)
      : ''
  }`;
  return keepTrailingZeros ? stripTrailingZero(result) : result;
};

// format Balance/Amount
export function formatBalance(value: string): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: '0', meta: { value } };
  }
  if (val.gte(1)) {
    if (val.gte(10e14)) {
      return {
        formattedValue: formatLocalNumber(val.div(10e14), 4, true),
        meta: {
          value,
          unit: 'Q',
        },
      };
    }

    if (val.gte(10e11)) {
      return {
        formattedValue: formatLocalNumber(val.div(10e11), 4, true),
        meta: {
          value,
          unit: 'T',
        },
      };
    }

    if (val.gte(10e8)) {
      return {
        formattedValue: formatLocalNumber(val.div(10e8), 4, true),
        meta: {
          value,
          unit: 'B',
        },
      };
    }
    return {
      formattedValue: formatLocalNumber(val, 4, true),
      meta: { value },
    };
  }

  const zeros = countLeadingZeroDecimals(val);
  return {
    formattedValue: formatLocalNumber(val, 4 + zeros, true),
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
    return {
      formattedValue: formatLocalNumber('0', 2, false, true),
      meta: { value, currency },
    };
  }
  if (val.gte(1)) {
    return {
      formattedValue: formatLocalNumber(val, 2, false, true),
      meta: { value, currency },
    };
  }

  const zeros = countLeadingZeroDecimals(val);
  return {
    formattedValue: formatLocalNumber(val, 4 + zeros, true),
    meta: { value, currency, leadingZeros: zeros },
  };
}

// PriceChange
export function formatPriceChange(value: string): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: '0.00', meta: { value, symbol: '%' } };
  }
  return {
    formattedValue: formatLocalNumber(val.toFixed(2)),
    meta: { value, symbol: '%' },
  };
}

// DeFi Value
export function formatDeFiValue(
  value: string,
  currency: string,
): IDisplayNumber {
  const val = new BigNumber(value);
  if (val.isNaN() || val.lt(0.01)) {
    return { formattedValue: '0.01', meta: { value, leading: '< ', currency } };
  }
  return {
    formattedValue: formatLocalNumber(val.toFixed(2)),
    meta: { value, currency },
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
      formattedValue: formatLocalNumber(val.div(10e11), 2, true),
      meta: { value, unit: 'T' },
    };
  }
  if (val.gte(10e8)) {
    return {
      formattedValue: formatLocalNumber(val.div(10e8), 2, true),
      meta: { value, unit: 'B' },
    };
  }
  if (val.gte(10e5)) {
    return {
      formattedValue: formatLocalNumber(val.div(10e5), 2, true),
      meta: { value, unit: 'M' },
    };
  }
  if (val.gte(10e2)) {
    return {
      formattedValue: formatLocalNumber(val.div(10e2), 2, true),
      meta: { value, unit: 'K' },
    };
  }
  return {
    formattedValue: formatLocalNumber(val, 2, true),
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
