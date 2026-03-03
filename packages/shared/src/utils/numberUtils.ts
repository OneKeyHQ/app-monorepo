import BigNumber from 'bignumber.js';

import { check } from '@onekeyhq/shared/src/utils/assertUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

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
  Q = 1e15,
  T = 1e12,
  B = 1e9,
  M = 1e6,
  K = 1e3,
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
  keepLeadingZero?: boolean;
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
    decimalSymbol?: string;
  } & IFormatterOptions;
}

const countLeadingZeroDecimals = (x: BigNumber): number => {
  // Fast path: values >= 1 never have leading zero decimals.
  // This avoids calling toFixed() on very large numbers which would
  // generate unnecessarily long strings.
  if (x.abs().gte(1)) return 0;
  const fixed = x.abs().toFixed();
  const dotIndex = fixed.indexOf('.');
  if (dotIndex === -1) return 0;
  const decimals = fixed.slice(dotIndex + 1);
  const trimmed = decimals.replace(/^0+/, '');
  return decimals.length - trimmed.length;
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

// Static decimal and grouping separators for all supported locales
// (sourced from Unicode CLDR via Node.js full-ICU Intl.NumberFormat). // cspell:ignore CLDR
// Hermes has incomplete ICU data for non-English locales, so we use this
// table instead of runtime detection. Keep in sync with localeJsonMap.ts.
export const LOCALE_SEPARATORS: Record<
  string,
  { decimal: string; grouping: string; indianGrouping?: boolean }
> = {
  'bn': { decimal: '.', grouping: ',', indianGrouping: true },
  'de': { decimal: ',', grouping: '.' },
  'en': { decimal: '.', grouping: ',' },
  'en-US': { decimal: '.', grouping: ',' },
  'es': { decimal: ',', grouping: '.' },
  'fr-FR': { decimal: ',', grouping: '\u202F' },
  'hi-IN': { decimal: '.', grouping: ',', indianGrouping: true },
  'id': { decimal: ',', grouping: '.' },
  'it-IT': { decimal: ',', grouping: '.' },
  'ja-JP': { decimal: '.', grouping: ',' },
  'ko-KR': { decimal: '.', grouping: ',' },
  'pt': { decimal: ',', grouping: '.' },
  'pt-BR': { decimal: ',', grouping: '.' },
  'ru': { decimal: ',', grouping: '\u00A0' },
  'th-TH': { decimal: '.', grouping: ',' },
  'uk-UA': { decimal: ',', grouping: '\u00A0' },
  'vi': { decimal: ',', grouping: '.' },
  'zh-CN': { decimal: '.', grouping: ',' },
  'zh-HK': { decimal: '.', grouping: ',' },
  'zh-TW': { decimal: '.', grouping: ',' },
};

const symbolMap: Record<string, string> = {};

// Clear cached separators when the app locale changes to prevent
// stale separators after a runtime language switch.
appLocale.onLocaleChange(() => {
  for (const key of Object.keys(symbolMap)) {
    delete symbolMap[key];
  }
});
const lazyDecimalSymbol = (digits: number) => {
  const locale = appLocale.intl.locale;
  if (!symbolMap[locale]) {
    // On Hermes (isNative), use the static table because Intl.NumberFormat
    // has incomplete ICU data for non-English locales.
    const known = platformEnv.isNative ? LOCALE_SEPARATORS[locale] : undefined;
    if (known) {
      symbolMap[locale] = known.decimal;
    } else {
      if (platformEnv.isNative && platformEnv.isDev) {
        console.warn(
          `[numberUtils] LOCALE_SEPARATORS missing for "${locale}". ` +
            `Falling back to Intl.NumberFormat which may be inaccurate on Hermes. ` +
            `Please add this locale to LOCALE_SEPARATORS in numberUtils.ts.`,
        );
      }
      symbolMap[locale] = formatNumber(0.1, {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })[1];
    }
  }
  return symbolMap[locale];
};

// Detect the locale-specific grouping separator.
const lazyGroupingSeparator = (): string => {
  const locale = appLocale.intl.locale;
  const key = `${locale}_group`;
  if (!symbolMap[key]) {
    const known = platformEnv.isNative ? LOCALE_SEPARATORS[locale] : undefined;
    if (known) {
      symbolMap[key] = known.grouping;
    } else {
      if (platformEnv.isNative && platformEnv.isDev) {
        console.warn(
          `[numberUtils] LOCALE_SEPARATORS missing for "${locale}". ` +
            `Falling back to Intl.NumberFormat which may be inaccurate on Hermes. ` +
            `Please add this locale to LOCALE_SEPARATORS in numberUtils.ts.`,
        );
      }
      const formatted = formatNumber(1000, {
        useGrouping: true,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
      symbolMap[key] = formatted.length === 5 ? formatted[1] : ',';
    }
  }
  return symbolMap[key];
};

// Insert grouping separator into a plain integer string.
// This avoids passing large numbers through Intl.NumberFormat which
// may overflow to Infinity or lose precision on Hermes.
// Supports Indian numbering (hi-IN, bn): first group is 3 digits,
// then every 2 digits (e.g. 1,00,00,000).
const insertGroupingSeparator = (intStr: string): string => {
  const isNegative = intStr.startsWith('-');
  const abs = isNegative ? intStr.slice(1) : intStr;
  const sep = lazyGroupingSeparator();
  const locale = appLocale.intl.locale;
  const useIndian =
    platformEnv.isNative && LOCALE_SEPARATORS[locale]?.indianGrouping;

  if (useIndian && abs.length > 3) {
    // Indian grouping: last 3 digits, then groups of 2 from the right
    const lastThree = abs.slice(-3);
    const rest = abs.slice(0, -3);
    let result = '';
    for (let i = 0; i < rest.length; i += 1) {
      if (i > 0 && (rest.length - i) % 2 === 0) {
        result += sep;
      }
      result += rest[i];
    }
    result += sep + lastThree;
    return isNegative ? `-${result}` : result;
  }

  // Standard 3-digit grouping
  let result = '';
  for (let i = 0; i < abs.length; i += 1) {
    if (i > 0 && (abs.length - i) % 3 === 0) {
      result += sep;
    }
    result += abs[i];
  }
  return isNegative ? `-${result}` : result;
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

  let formattedInteger: string;
  const isNegativeInt = integerPart.startsWith('-');
  if (disableThousandSeparator) {
    formattedInteger = integerPart;
  } else {
    const absInt = isNegativeInt ? integerPart.slice(1) : integerPart;
    const numericValue = Number(absInt);
    if (!Number.isFinite(numericValue)) {
      // Number overflows to Infinity — fall through to the ∞ check below.
      formattedInteger = formatNumber(numericValue, { useGrouping: true });
    } else if (platformEnv.isNative || numericValue > Number.MAX_SAFE_INTEGER) {
      // On Hermes (isNative), always use manual grouping because
      // Intl.NumberFormat has incomplete ICU data for non-English locales.
      // For > MAX_SAFE_INTEGER, also use manual grouping to avoid
      // precision loss when converting to JS number.
      formattedInteger = insertGroupingSeparator(integerPart);
    } else {
      // On Node.js / browsers with full ICU, use Intl.NumberFormat.
      formattedInteger = formatNumber(
        isNegativeInt && absInt !== '0' ? -numericValue : numericValue,
        { useGrouping: true },
      );
    }
  }

  // Restore leading "-" when the integer part is "-0" (formatNumber
  // normalizes -0 to "0", so the sign must be re-added manually).
  // insertGroupingSeparator preserves the sign, so this only applies
  // to the formatNumber path.
  const needsNegZeroRestore =
    integerPart === '-0' && !formattedInteger.startsWith('-');
  const integer = `${needsNegZeroRestore ? '-' : ''}${formattedInteger}`;

  const decimalSymbol = lazyDecimalSymbol(digits);
  const formatDecimal = decimalPart ? `${decimalSymbol}${decimalPart}` : '';
  // Hermes may produce '+∞' instead of '∞' for Infinity.
  if (integer.includes('∞')) {
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

// Shared preamble: returns IDisplayNumber for NaN/zero, or null to continue.
const handleNaNOrZero = (
  val: BigNumber,
  value: string,
  zeroOpts: {
    digits: number;
    removeTrailingZeros: boolean;
    disableThousandSeparator?: boolean;
  },
  options?: IFormatterOptions,
  metaExtras?: Partial<IDisplayNumber['meta']>,
): IDisplayNumber | null => {
  if (val.isNaN()) {
    return { formattedValue: value, meta: { value, invalid: true } };
  }
  if (val.eq(0)) {
    const { value: formattedValue, decimalSymbol } = formatLocalNumber('0', {
      digits: zeroOpts.digits,
      removeTrailingZeros: zeroOpts.removeTrailingZeros,
      disableThousandSeparator: zeroOpts.disableThousandSeparator,
    });
    return {
      formattedValue,
      meta: {
        value,
        isZero: true,
        decimalSymbol,
        ...metaExtras,
        ...options,
      },
    };
  }
  return null;
};

// Shared unit-based formatting for formatBalance and formatMarketCap.
const BALANCE_UNITS: Array<{
  threshold: BigNumber;
  divisor: BigNumber;
  unit: ENumberUnit;
}> = [
  {
    threshold: new BigNumber(ENumberUnitValue.Q),
    divisor: new BigNumber(ENumberUnitValue.Q),
    unit: ENumberUnit.Q,
  },
  {
    threshold: new BigNumber(ENumberUnitValue.T),
    divisor: new BigNumber(ENumberUnitValue.T),
    unit: ENumberUnit.T,
  },
  {
    threshold: new BigNumber(ENumberUnitValue.B),
    divisor: new BigNumber(ENumberUnitValue.B),
    unit: ENumberUnit.B,
  },
];

const MARKET_CAP_UNITS: Array<{
  threshold: BigNumber;
  divisor: BigNumber;
  unit: ENumberUnit;
}> = [
  {
    threshold: new BigNumber(ENumberUnitValue.T),
    divisor: new BigNumber(ENumberUnitValue.T),
    unit: ENumberUnit.T,
  },
  {
    threshold: new BigNumber(ENumberUnitValue.B),
    divisor: new BigNumber(ENumberUnitValue.B),
    unit: ENumberUnit.B,
  },
  {
    threshold: new BigNumber(ENumberUnitValue.M),
    divisor: new BigNumber(ENumberUnitValue.M),
    unit: ENumberUnit.M,
  },
  {
    threshold: new BigNumber(ENumberUnitValue.K),
    divisor: new BigNumber(ENumberUnitValue.K),
    unit: ENumberUnit.K,
  },
];

const formatWithUnits = (
  val: BigNumber,
  value: string,
  units: Array<{
    threshold: BigNumber;
    divisor: BigNumber;
    unit: ENumberUnit;
  }>,
  opts: {
    digits: number;
    removeTrailingZeros: boolean;
    disableThousandSeparator?: boolean;
  },
  options?: IFormatterOptions,
  unitHook?: (
    dividedValue: BigNumber,
    unit: ENumberUnit,
  ) => { value: BigNumber; extraMeta?: Partial<IDisplayNumber['meta']> } | null,
): IDisplayNumber | null => {
  const absValue = val.abs();
  for (const { threshold, divisor, unit } of units) {
    if (absValue.gte(threshold)) {
      let dividedValue = val.div(divisor);
      let extraMeta: Partial<IDisplayNumber['meta']> | undefined;
      if (unitHook) {
        const hookResult = unitHook(dividedValue, unit);
        if (hookResult) {
          dividedValue = hookResult.value;
          extraMeta = hookResult.extraMeta;
        }
      }
      const {
        value: formattedValue,
        decimalSymbol,
        roundValue,
      } = formatLocalNumber(dividedValue, opts);
      return {
        formattedValue,
        meta: {
          value,
          unit,
          roundValue,
          decimalSymbol,
          ...extraMeta,
          ...options,
        },
      };
    }
  }
  return null;
};

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

  const fmtOpts = {
    digits: 4,
    removeTrailingZeros: true,
    disableThousandSeparator: options?.disableThousandSeparator,
  };

  if (absValue.gte(1)) {
    const unitResult = formatWithUnits(
      val,
      value,
      BALANCE_UNITS,
      fmtOpts,
      options,
    );
    if (unitResult) return unitResult;

    const {
      value: formattedValue,
      decimalSymbol,
      roundValue,
    } = formatLocalNumber(val, fmtOpts);
    return {
      formattedValue,
      meta: { value, roundValue, decimalSymbol, ...options },
    };
  }

  const zeros = countLeadingZeroDecimals(val);
  const {
    value: formattedValue,
    decimalSymbol,
    roundValue,
  } = formatLocalNumber(val, { ...fmtOpts, digits: 4 + zeros });
  return {
    formattedValue,
    meta: { value, leadingZeros: zeros, roundValue, decimalSymbol, ...options },
  };
};

/** Price/USD */
export const formatPrice: IFormatNumberFunc = (value, options) => {
  const { currency } = options || {};
  const val = new BigNumber(value);
  const nanOrZero = handleNaNOrZero(
    val,
    value,
    {
      digits: 2,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    },
    options,
    { currency },
  );
  if (nanOrZero) return nanOrZero;

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
  const nanOrZero = handleNaNOrZero(
    val,
    value,
    {
      digits: 2,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    },
    options,
    { symbol: '%' },
  );
  if (nanOrZero) return nanOrZero;

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
  const isCapped = val.gt(99_999) || val.lt(-99_999);

  // Apply clamping
  const min = new BigNumber(-99_999);
  const max = new BigNumber(99_999);
  const clampedValue = BigNumber.max(min, BigNumber.min(max, val));
  const finalValue = clampedValue.decimalPlaces(2, BigNumber.ROUND_HALF_UP);

  const digits = isCapped ? 0 : 2;

  const nanOrZero = handleNaNOrZero(
    finalValue,
    value,
    {
      digits,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    },
    options,
    { symbol: '%', isCapped },
  );
  if (nanOrZero) return nanOrZero;

  const { value: formattedValue, decimalSymbol } = formatLocalNumber(
    finalValue.toFixed(digits),
    {
      digits,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    },
  );

  return {
    formattedValue,
    meta: { value, symbol: '%', decimalSymbol, isCapped, ...options },
  };
};

/** DeFi Value */
export const formatValue: IFormatNumberFunc = (value, options) => {
  const { currency } = options || {};
  const val = new BigNumber(value);
  const nanOrZero = handleNaNOrZero(
    val,
    value,
    {
      digits: 2,
      removeTrailingZeros: false,
      disableThousandSeparator: options?.disableThousandSeparator,
    },
    options,
    { currency },
  );
  if (nanOrZero) return nanOrZero;

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
  const fmtOpts = {
    digits: 2,
    removeTrailingZeros: true,
    disableThousandSeparator: options?.disableThousandSeparator,
  };

  const nanOrZero = handleNaNOrZero(val, value, fmtOpts, options);
  if (nanOrZero) return nanOrZero;

  const unitResult = formatWithUnits(
    val,
    value,
    MARKET_CAP_UNITS,
    fmtOpts,
    options,
    (dividedValue, unit) => {
      if (unit === ENumberUnit.T && options?.capAtMaxT) {
        // Cap at 999T max only if capAtMaxT option is enabled
        const isOverMax = dividedValue.gt(999);
        return {
          value: isOverMax ? new BigNumber(999) : dividedValue,
          extraMeta: { isCapped: isOverMax },
        };
      }
      return null;
    },
  );
  if (unitResult) return unitResult;

  const { value: formattedValue, decimalSymbol } = formatLocalNumber(
    val,
    fmtOpts,
  );
  return {
    formattedValue,
    meta: { value, decimalSymbol, ...options },
  };
};

/** Antonym/Opposite Value */
export const formatAntonym: IFormatNumberFunc = (value, options) => {
  const val = new BigNumber(value);
  const nanOrZero = handleNaNOrZero(
    val,
    value,
    {
      digits: 4,
      removeTrailingZeros: true,
      disableThousandSeparator: options?.disableThousandSeparator,
    },
    options,
  );
  if (nanOrZero) return nanOrZero;

  // Negate the value
  const oppositeVal = val.negated();
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

export type IFormatDisplayNumberPart =
  | string
  | { value: number; type: 'sub' }
  | { value: string; type: 'decimal' };

export const formatDisplayNumber = (
  value: IDisplayNumber,
  options?: { splitDecimal?: boolean },
): string | IFormatDisplayNumberPart[] => {
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
      keepLeadingZero,
      decimalSymbol,
    },
  } = value;
  const isNegativeNumber =
    formattedValue[0] === '-' || (isZero && rawValue[0] === '-');
  const valueWithoutSign =
    isNegativeNumber && !isZero ? formattedValue.slice(1) : formattedValue;
  if (invalid) {
    if (platformEnv.isDev && !platformEnv.isJest) {
      console.error(
        `fail to format invalid number: ${rawValue}, please check it again`,
      );
    }
    return formattedValue;
  }
  const strings: IFormatDisplayNumberPart[] = [];
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

  if (leadingZeros && leadingZeros > 4 && !keepLeadingZero) {
    const { value: formattedZero } = formatLocalNumber('0', {
      digits: 1,
      removeTrailingZeros: false,
      disableThousandSeparator: false,
    });
    strings.push(formattedZero);
    strings.push({ value: leadingZeros, type: 'sub' });
    strings.push(valueWithoutSign.slice(leadingZeros + 2));
  } else if (options?.splitDecimal) {
    const decSym = decimalSymbol || lazyDecimalSymbol(2);
    const decIndex = valueWithoutSign.lastIndexOf(decSym);
    if (decIndex >= 0) {
      strings.push(valueWithoutSign.slice(0, decIndex));
      strings.push({
        value: valueWithoutSign.slice(decIndex),
        type: 'decimal',
      });
    } else {
      strings.push(valueWithoutSign);
    }
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
  if (
    options?.splitDecimal ||
    (leadingZeros && leadingZeros > 4 && !keepLeadingZero)
  ) {
    return strings;
  }
  return strings.join('');
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
  /** Separate the decimal point and fractional digits as a distinct part for styling. @default false */
  splitDecimal?: boolean;
}

export const numberFormatAsRaw = (
  value: string,
  { formatter, formatterOptions, splitDecimal }: INumberFormatProps,
) => {
  return formatter && value
    ? formatDisplayNumber(
        NUMBER_FORMATTER[formatter](String(value), formatterOptions),
        { splitDecimal },
      )
    : '';
};

export const numberFormat = memoizee(
  (value: string, { formatter, formatterOptions }: INumberFormatProps) => {
    const result = numberFormatAsRaw(value, { formatter, formatterOptions });
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
  },
  {
    max: 200,
    maxAge: 1000 * 60 * 5, // 5 minutes
  },
);

export const numberFormatAsRenderText = (
  value: string,
  { formatter, formatterOptions, splitDecimal }: INumberFormatProps,
) => {
  const result = numberFormatAsRaw(value, {
    formatter,
    formatterOptions,
    splitDecimal,
  });
  return result;
};
