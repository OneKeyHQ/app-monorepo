import BigNumber from 'bignumber.js';

import { check } from '@onekeyhq/shared/src/utils/assertUtils';

import { appLocale, fallbackAppLocaleIntl } from '../locale/appLocale';
import platformEnv from '../platformEnv';

import hexUtils from './hexUtils';

import type { FormatNumberOptions } from '@formatjs/intl';

export enum ENumberUnit {
  Q = 'Q',
  T = 'T',
  B = 'B',
  M = 'M',
  K = 'K',
}

export enum ENumberUnitValue {
  Q = 10e14,
  T = 10e11,
  B = 10e8,
  M = 10e5,
  K = 10e2,
}

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

export default { numberToHex, hexToDecimal, fromBigIntHex, toBigIntHex };

export { fromBigIntHex, toBigIntHex };

export type IFormatterOptions = {
  currency?: string;
  tokenSymbol?: string;
  showPlusMinusSigns?: boolean;
  disableThousandSeparator?: boolean;
  capAtMaxT?: boolean;
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
    roundValue?: string;
    isZero?: boolean;
    isCapped?: boolean;
  } & IFormatterOptions;
}

const countLeadingZeroDecimals = (x: BigNumber) => {
  const counts = -Math.floor(Math.log10(x.abs().toNumber()) + 1);
  return counts > 0 ? counts : 0;
};

const stripTrailingZero = (x: string, decimalSymbol: string) =>
  x.replace(
    new RegExp(`(\\${decimalSymbol}[0-9]*[1-9])0+$|\\${decimalSymbol}0*$`),
    '$1',
  );

const formatNumber = (value: number, options?: FormatNumberOptions) => {
  // Bengali number formatting falls back to default 'en' style.
  if (['bn'].includes(appLocale.intl.locale)) {
    return fallbackAppLocaleIntl.formatNumber(value, options);
  }
  return appLocale.intl.formatNumber(value, options);
};

const symbolMap: Record<string, string> = {};
const lazyDecimalSymbol = (digits: number) => {
  const locale = appLocale.intl.locale;
  if (!symbolMap[locale]) {
    symbolMap[locale] = formatNumber(0.1, {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    })[1];
  }
  return symbolMap[locale];
};

const formatLocalNumber = (
  value: BigNumber | string,
  {
    digits = 2,
    removeTrailingZeros = false,
    disableThousandSeparator = false,
  }: {
    digits: number;
    removeTrailingZeros: boolean;
    disableThousandSeparator?: boolean;
  },
) => {
  const num = new BigNumber(value).toFixed(digits, BigNumber.ROUND_HALF_UP);

  const [integerPart, decimalPart] = num.split('.');
  const integer = `${integerPart === '-0' ? '-' : ''}${
    disableThousandSeparator
      ? integerPart
      : formatNumber(new BigNumber(integerPart).toFixed() as any, {
          useGrouping: true,
        })
  }`;
  const decimalSymbol = lazyDecimalSymbol(digits);
  const formatDecimal = `${decimalSymbol}${decimalPart}`;
  if (integer === '∞') {
    return {
      value: num,
      decimalSymbol,
      roundValue: num,
    };
  }
  const result = `${integer}${formatDecimal}`;

  return {
    value: removeTrailingZeros
      ? stripTrailingZero(result, decimalSymbol)
      : result,
    decimalSymbol,
    roundValue: num,
  };
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
    if (absValue.gte(ENumberUnitValue.Q)) {
      const {
        value: formattedValue,
        decimalSymbol,
        roundValue,
      } = formatLocalNumber(val.div(ENumberUnitValue.Q), {
        digits: 4,
        removeTrailingZeros: true,
        disableThousandSeparator: options?.disableThousandSeparator,
      });
      return {
        formattedValue,
        meta: {
          value,
          unit: ENumberUnit.Q,
          roundValue,
          decimalSymbol,
          ...options,
        },
      };
    }

    if (absValue.gte(ENumberUnitValue.T)) {
      const {
        value: formattedValue,
        decimalSymbol,
        roundValue,
      } = formatLocalNumber(val.div(ENumberUnitValue.T), {
        digits: 4,
        removeTrailingZeros: true,
        disableThousandSeparator: options?.disableThousandSeparator,
      });
      return {
        formattedValue,
        meta: {
          value,
          unit: ENumberUnit.T,
          roundValue,
          decimalSymbol,
          ...options,
        },
      };
    }

    if (absValue.gte(ENumberUnitValue.B)) {
      const {
        value: formattedValue,
        decimalSymbol,
        roundValue,
      } = formatLocalNumber(val.div(ENumberUnitValue.B), {
        digits: 4,
        removeTrailingZeros: true,
        disableThousandSeparator: options?.disableThousandSeparator,
      });
      return {
        formattedValue,
        meta: {
          value,
          unit: ENumberUnit.B,
          roundValue,
          decimalSymbol,
          ...options,
        },
      };
    }
    const {
      value: formattedValue,
      decimalSymbol,
      roundValue,
    } = formatLocalNumber(val, {
      digits: 4,
      removeTrailingZeros: true,
      disableThousandSeparator: options?.disableThousandSeparator,
    });
    return {
      formattedValue,
      meta: {
        value,
        roundValue,
        decimalSymbol,
        ...options,
      },
    };
  }

  const zeros = countLeadingZeroDecimals(val);
  const {
    value: formattedValue,
    decimalSymbol,
    roundValue,
  } = formatLocalNumber(val, {
    digits: 4 + zeros,
    removeTrailingZeros: true,
    disableThousandSeparator: options?.disableThousandSeparator,
  });
  return {
    formattedValue,
    meta: {
      value,
      leadingZeros: zeros,
      roundValue,
      decimalSymbol,
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
    const { value: formattedValue, decimalSymbol } = formatLocalNumber('0', {
      digits: 2,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    });
    return {
      formattedValue,
      meta: { value, currency, isZero: true, decimalSymbol, ...options },
    };
  }
  if (val.gte(1)) {
    const { value: formattedValue, decimalSymbol } = formatLocalNumber(val, {
      digits: 2,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    });
    return {
      formattedValue,
      meta: { value, currency, decimalSymbol, ...options },
    };
  }

  const zeros = countLeadingZeroDecimals(val);
  const { value: formattedValue, decimalSymbol } = formatLocalNumber(val, {
    digits: 4 + zeros,
    removeTrailingZeros: true,
    disableThousandSeparator: options?.disableThousandSeparator,
  });
  return {
    formattedValue,
    meta: { value, currency, leadingZeros: zeros, decimalSymbol, ...options },
  };
};

/** Clamp percentage value between -999.99 and 999.99 */
export const clampPercentage = (value: string | number): number => {
  const bigValue = new BigNumber(value);
  if (bigValue.isNaN()) {
    return 0;
  }
  const min = new BigNumber(-999.99);
  const max = new BigNumber(999.99);
  const clampedValue = BigNumber.max(min, BigNumber.min(max, bigValue));
  return clampedValue.decimalPlaces(2, BigNumber.ROUND_HALF_UP).toNumber();
};

/** PriceChange */
export const formatPriceChange: IFormatNumberFunc = (value, options) => {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: value, meta: { value, invalid: true } };
  }
  if (val.eq(0)) {
    const { value: formattedValue, decimalSymbol } = formatLocalNumber('0', {
      digits: 2,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    });
    return {
      formattedValue,
      meta: { value, isZero: true, symbol: '%', decimalSymbol, ...options },
    };
  }
  const { value: formattedValue, decimalSymbol } = formatLocalNumber(
    val.toFixed(2),
    {
      digits: 2,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    },
  );
  return {
    formattedValue,
    meta: { value, symbol: '%', decimalSymbol, ...options },
  };
};

/** PriceChange with capping and > symbol support */
export const formatPriceChangeCapped: IFormatNumberFunc = (value, options) => {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: value, meta: { value, invalid: true } };
  }

  // Check if value exceeds the clamp range
  const isOverMax = val.gt(999.99);
  const isUnderMin = val.lt(-999.99);
  const isCapped = isOverMax || isUnderMin;

  // Apply clamping (same logic as clampPercentage)
  const min = new BigNumber(-999.99);
  const max = new BigNumber(999.99);
  const clampedValue = BigNumber.max(min, BigNumber.min(max, val));
  const finalValue = clampedValue.decimalPlaces(2, BigNumber.ROUND_HALF_UP);

  if (finalValue.eq(0)) {
    const { value: formattedValue, decimalSymbol } = formatLocalNumber('0', {
      digits: 2,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    });
    return {
      formattedValue,
      meta: {
        value,
        isZero: true,
        symbol: '%',
        decimalSymbol,
        isCapped,
        ...options,
      },
    };
  }

  const { value: formattedValue, decimalSymbol } = formatLocalNumber(
    finalValue.toFixed(2),
    {
      digits: 2,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    },
  );

  return {
    formattedValue,
    meta: {
      value,
      symbol: '%',
      decimalSymbol,
      isCapped,
      ...options,
    },
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
    const { value: formattedValue, decimalSymbol } = formatLocalNumber('0', {
      digits: 2,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    });
    return {
      formattedValue,
      meta: { value, currency, isZero: true, decimalSymbol, ...options },
    };
  }
  if (val.lt(0.01)) {
    const { value: formattedValue, decimalSymbol } = formatLocalNumber('0.01', {
      digits: 2,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    });
    return {
      formattedValue,
      meta: { value, leading: '< ', currency, decimalSymbol, ...options },
    };
  }
  const { value: formattedValue, decimalSymbol } = formatLocalNumber(
    val.toFixed(2),
    {
      digits: 2,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    },
  );
  return {
    formattedValue,
    meta: { value, currency, decimalSymbol, ...options },
  };
};

/** FDV / MarketCap / Volume / Liquidty / TVL / TokenSupply */
export const formatMarketCap: IFormatNumberFunc = (value, options) => {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: value, meta: { value, invalid: true } };
  }
  if (val.eq(0)) {
    const { value: formattedValue, decimalSymbol } = formatLocalNumber('0', {
      digits: 2,
      removeTrailingZeros: true,
      disableThousandSeparator: options?.disableThousandSeparator,
    });
    return {
      formattedValue,
      meta: { value, isZero: true, decimalSymbol, ...options },
    };
  }

  if (val.gte(ENumberUnitValue.T)) {
    const dividedValue = val.div(ENumberUnitValue.T);

    // Cap at 999T max only if capAtMaxT option is enabled
    const isOverMax = options?.capAtMaxT && dividedValue.gt(999);
    const cappedValue = isOverMax ? new BigNumber(999) : dividedValue;

    const { value: formattedValue, decimalSymbol } = formatLocalNumber(
      cappedValue,
      {
        digits: 2,
        removeTrailingZeros: true,
        disableThousandSeparator: options?.disableThousandSeparator,
      },
    );

    // Use formatted value directly (999 when capped)
    const finalFormattedValue = formattedValue;

    return {
      formattedValue: finalFormattedValue,
      meta: {
        value,
        unit: ENumberUnit.T,
        decimalSymbol,
        isCapped: isOverMax,
        ...options,
      },
    };
  }
  if (val.gte(ENumberUnitValue.B)) {
    const { value: formattedValue, decimalSymbol } = formatLocalNumber(
      val.div(ENumberUnitValue.B),
      {
        digits: 2,
        removeTrailingZeros: true,
        disableThousandSeparator: options?.disableThousandSeparator,
      },
    );
    return {
      formattedValue,
      meta: { value, unit: ENumberUnit.B, decimalSymbol, ...options },
    };
  }
  if (val.gte(ENumberUnitValue.M)) {
    const { value: formattedValue, decimalSymbol } = formatLocalNumber(
      val.div(ENumberUnitValue.M),
      {
        digits: 2,
        removeTrailingZeros: true,
        disableThousandSeparator: options?.disableThousandSeparator,
      },
    );
    return {
      formattedValue,
      meta: { value, unit: ENumberUnit.M, decimalSymbol, ...options },
    };
  }
  if (val.gte(ENumberUnitValue.K)) {
    const { value: formattedValue, decimalSymbol } = formatLocalNumber(
      val.div(ENumberUnitValue.K),
      {
        digits: 2,
        removeTrailingZeros: true,
        disableThousandSeparator: options?.disableThousandSeparator,
      },
    );
    return {
      formattedValue,
      meta: { value, unit: ENumberUnit.K, decimalSymbol, ...options },
    };
  }
  const { value: formattedValue, decimalSymbol } = formatLocalNumber(val, {
    digits: 2,
    removeTrailingZeros: true,
    disableThousandSeparator: options?.disableThousandSeparator,
  });
  return {
    formattedValue,
    meta: { value, decimalSymbol, ...options },
  };
};

/** Antonym/Opposite Value */
export const formatAntonym: IFormatNumberFunc = (value, options) => {
  const val = new BigNumber(value);
  if (val.isNaN()) {
    return { formattedValue: value, meta: { value, invalid: true } };
  }
  // Negate the value
  const oppositeVal = val.negated();

  if (oppositeVal.eq(0)) {
    const { value: formattedValue, decimalSymbol } = formatLocalNumber('0', {
      digits: 4,
      removeTrailingZeros: true,
      disableThousandSeparator: options?.disableThousandSeparator,
    });
    return {
      formattedValue,
      meta: { value, isZero: true, decimalSymbol, ...options },
    };
  }

  const { value: formattedValue, decimalSymbol } = formatLocalNumber(
    oppositeVal,
    {
      digits: 4,
      removeTrailingZeros: true,
      disableThousandSeparator: options?.disableThousandSeparator,
    },
  );
  return {
    formattedValue,
    meta: { value, decimalSymbol, ...options },
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
  const valueWithoutSign =
    isNegativeNumber && !isZero ? formattedValue.slice(1) : formattedValue;
  const startsNumberIndex = 0;

  if (invalid) {
    if (platformEnv.isDev && !platformEnv.isJest) {
      console.error(
        `fail to format invalid number: ${rawValue}, please check it again`,
      );
    }
    return formattedValue;
  }
  const strings = [];
  if (leading) {
    strings.push(leading);
  }

  // Add ">" prefix for capped values
  if (value.meta.isCapped) {
    strings.push('>');
  }

  if (isNegativeNumber && !isZero) {
    strings.push('-');
  } else if (showPlusMinusSigns) {
    // -0/+0
    strings.push(isNegativeNumber ? '-' : '+');
  }

  if (currency) {
    strings.push(currency);
  }

  if (leadingZeros && leadingZeros > 4) {
    const { value: formattedZero } = formatLocalNumber('0', {
      digits: 1,
      removeTrailingZeros: false,
      disableThousandSeparator: false,
    });
    strings.push(formattedZero);
    strings.push({ value: leadingZeros, type: 'sub' });
    strings.push(valueWithoutSign.slice(leadingZeros + 2 + startsNumberIndex));
  } else {
    strings.push(valueWithoutSign);
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
  /** PriceChange with capping and > symbol support */
  priceChangeCapped: formatPriceChangeCapped,
  /** DeFi */
  value: formatValue,
  /** FDV / MarketCap / Volume / Liquidty / TVL / TokenSupply */
  marketCap: formatMarketCap,
  /** Antonym/Opposite Value */
  antonym: formatAntonym,
};

export interface INumberFormatProps {
  hideValue?: boolean;
  formatter?: keyof typeof NUMBER_FORMATTER;
  formatterOptions?: IFormatterOptions;
}

export const numberFormat = (
  value: string,
  { formatter, formatterOptions }: INumberFormatProps,
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
        return new Array(r.value - 1).fill(0).join('');
      }
      return '';
    })
    .join('');
};
