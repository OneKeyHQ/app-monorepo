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

export type IFormatterOptions = {
  currency?: string;
  tokenSymbol?: string;
  showPlusMinusSigns?: boolean;
};

export interface IDisplayNumber {
  formattedValue: string;
  meta: {
    value: string;
    invalid?: boolean;
    unit?: string;
    leadingZeros?: number;
    leading?: string;
    symbol?: string;
    isZero?: boolean;
  } & IFormatterOptions;
}

const countLeadingZeroDecimals = (x: BigNumber) => {
  const counts = -Math.floor(Math.log10(x.abs().toNumber()) + 1);
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

export type IFormatNumberFunc = (
  value: string,
  options?: IFormatterOptions,
) => IDisplayNumber;

/** Balance/Amount */
export const formatBalance: IFormatNumberFunc = (value, options) => {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: value, meta: { value, invalid: true } };
  }
  const absValue = val.abs();
  if (absValue.eq(0)) {
    return { formattedValue: '0', meta: { value, isZero: true, ...options } };
  }
  if (absValue.gte(1)) {
    if (absValue.gte(10e14)) {
      return {
        formattedValue: formatLocalNumber(val.div(10e14), 4, true),
        meta: {
          value,
          unit: 'Q',
          ...options,
        },
      };
    }

    if (absValue.gte(10e11)) {
      return {
        formattedValue: formatLocalNumber(val.div(10e11), 4, true),
        meta: {
          value,
          unit: 'T',
          ...options,
        },
      };
    }

    if (absValue.gte(10e8)) {
      return {
        formattedValue: formatLocalNumber(val.div(10e8), 4, true),
        meta: {
          value,
          unit: 'B',
          ...options,
        },
      };
    }
    return {
      formattedValue: formatLocalNumber(val, 4, true),
      meta: { value, ...options },
    };
  }

  const zeros = countLeadingZeroDecimals(val);
  return {
    formattedValue: formatLocalNumber(val, 4 + zeros, true),
    meta: {
      value,
      leadingZeros: zeros,
      ...options,
    },
  };
};

/** Price/USD */
export const formatPrice: IFormatNumberFunc = (value, options) => {
  const { currency } = options || {};
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: value, meta: { value, invalid: true } };
  }
  if (val.eq(0)) {
    return {
      formattedValue: formatLocalNumber('0', 2, false, true),
      meta: { value, currency, isZero: true, ...options },
    };
  }
  if (val.gte(1)) {
    return {
      formattedValue: formatLocalNumber(val, 2, false, true),
      meta: { value, currency, ...options },
    };
  }

  const zeros = countLeadingZeroDecimals(val);
  return {
    formattedValue: formatLocalNumber(val, 4 + zeros, true),
    meta: { value, currency, leadingZeros: zeros, ...options },
  };
};

/** PriceChange */
export const formatPriceChange: IFormatNumberFunc = (value, options) => {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: value, meta: { value, invalid: true } };
  }
  if (val.eq(0)) {
    return {
      formattedValue: '0.00',
      meta: { value, isZero: true, symbol: '%', ...options },
    };
  }
  return {
    formattedValue: formatLocalNumber(val.toFixed(2)),
    meta: { value, symbol: '%', ...options },
  };
};

/** DeFi Value */
export const formatValue: IFormatNumberFunc = (value, options) => {
  const { currency } = options || {};
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: value, meta: { value, invalid: true } };
  }
  if (val.eq(0)) {
    return {
      formattedValue: '0.00',
      meta: { value, currency, isZero: true, ...options },
    };
  }
  if (val.lt(0.01)) {
    return {
      formattedValue: '0.01',
      meta: { value, leading: '< ', currency, ...options },
    };
  }
  return {
    formattedValue: formatLocalNumber(val.toFixed(2)),
    meta: { value, currency, ...options },
  };
};

/** FDV / MarketCap / Volume / Liquidty / TVL / TokenSupply */
export const formatMarketCap: IFormatNumberFunc = (value, options) => {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: value, meta: { value, invalid: true } };
  }
  if (val.eq(0)) {
    return {
      formattedValue: '0',
      meta: { value, isZero: true, ...options },
    };
  }

  if (val.gte(10e11)) {
    return {
      formattedValue: formatLocalNumber(val.div(10e11), 2, true),
      meta: { value, unit: 'T', ...options },
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
      meta: { value, unit: 'M', ...options },
    };
  }
  if (val.gte(10e2)) {
    return {
      formattedValue: formatLocalNumber(val.div(10e2), 2, true),
      meta: { value, unit: 'K', ...options },
    };
  }
  return {
    formattedValue: formatLocalNumber(val, 2, true),
    meta: { value, ...options },
  };
};

export const formatDisplayNumber = (value: IDisplayNumber) => {
  const {
    formattedValue,
    meta: {
      value: rawValue,
      invalid,
      leading,
      leadingZeros,
      currency,
      unit,
      symbol,
      showPlusMinusSigns,
      tokenSymbol,
      isZero,
    },
  } = value;
  const isNegativeNumber =
    formattedValue[0] === '-' || (isZero && rawValue[0] === '-');
  const startsNumberIndex = isNegativeNumber ? 1 : 0;

  if (invalid) {
    return formattedValue;
  }
  const strings = [];
  if (leading) {
    strings.push(leading);
  }
  if (currency) {
    strings.push(currency);
  }

  if (showPlusMinusSigns && !isNegativeNumber) {
    strings.push('+');
  }
  if (leadingZeros && leadingZeros > 4) {
    if (isNegativeNumber) {
      strings.push('-');
    }
    strings.push('0.0');
    strings.push({ value: leadingZeros, type: 'sub' });
    strings.push(formattedValue.slice(leadingZeros + 2 + startsNumberIndex));
  } else {
    if (showPlusMinusSigns && isZero && isNegativeNumber) {
      strings.push('-');
    }
    strings.push(formattedValue);
  }
  if (unit) {
    strings.push(unit);
  }
  if (symbol) {
    strings.push(symbol);
  }
  if (tokenSymbol) {
    strings.push(' ');
    strings.push(tokenSymbol);
  }
  return leadingZeros && leadingZeros > 4 ? strings : strings.join('');
};

export const NUMBER_FORMATTER = {
  /** Balance/Amount */
  balance: formatBalance,
  /** Price/USD */
  price: formatPrice,
  /** PriceChange */
  priceChange: formatPriceChange,
  /** DeFi */
  value: formatValue,
  /** FDV / MarketCap / Volume / Liquidty / TVL / TokenSupply */
  marketCap: formatMarketCap,
};

export interface INumberFormatProps {
  formatter?: keyof typeof NUMBER_FORMATTER;
  formatterOptions?: IFormatterOptions;
  value?: string | number | undefined;
}

export const numberFormat = (
  { value, formatter, formatterOptions }: INumberFormatProps,
  isRaw = false,
) => {
  const result =
    formatter && value
      ? formatDisplayNumber(
          NUMBER_FORMATTER[formatter](String(value), formatterOptions),
        )
      : '';
  if (isRaw) {
    return result;
  }

  if (typeof result === 'string') {
    return result;
  }

  return result
    .map((r) => {
      if (typeof r === 'string') {
        return r;
      }
      if (r.type === 'sub') {
        return new Array(r.value).fill(0).join('');
      }
      return '';
    })
    .join('');
};
