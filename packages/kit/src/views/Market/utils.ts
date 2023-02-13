export function parseExponential(value?: number) {
  if (!value) return 0;
  const e = /\d(?:\.(\d*))?e([+-]\d+)/.exec(value.toExponential());
  return e
    ? value.toFixed(Math.max(0, (e[1] || '').length - parseInt(e[2])))
    : value;
}

export function formatMarketValueForComma(value?: number) {
  if (value) {
    let resValue = '';
    const noExponentialNumber = parseExponential(value);
    const valueStr = noExponentialNumber.toString();
    const dotIndex = valueStr.indexOf('.');
    let subStr = dotIndex === -1 ? valueStr : valueStr.substring(0, dotIndex);
    const decimals = dotIndex !== -1 ? valueStr.substring(dotIndex + 1) : null;
    while (subStr.length > 3) {
      resValue = `,${subStr.slice(-3)}${resValue}`;
      subStr = subStr.slice(0, subStr.length - 3);
    }
    if (subStr) resValue = subStr + resValue;
    if (decimals) resValue = `${resValue}.${decimals}`;
    return resValue;
  }
  return '0.00';
}

export function formatMarketValueForFiexd(
  value?: number,
  fractionDigits?: number,
) {
  if (value) {
    // const resValue = fractionDigits
    //   ? value.toFixed(fractionDigits).replace(/0+$/g, '')
    //   : value.toFixed(2).replace(/0+$/g, '');

    return fractionDigits ? value.toFixed(fractionDigits) : value.toFixed(2);
  }
  return '0.00';
}

export function formatMarketVolatility(
  value?: number,
  fractionDigits?: number,
) {
  if (value) {
    return `${value >= 0 ? '+' : ''}${formatMarketValueForFiexd(
      value,
      fractionDigits,
    )}`;
  }
  return '0.00';
}

export function formatDecimalZero(value: number) {
  if (value >= 1) return formatMarketValueForFiexd(value);
  const noRexponentail = parseExponential(value);
  const effectIndex = noRexponentail.toString().search(/[^-.0]/g);
  const zeroCount = effectIndex - 2;
  const fiexdValue = formatMarketValueForFiexd(value, 3 + zeroCount);
  if (zeroCount >= 3) {
    return `0.{${zeroCount}}${fiexdValue.toString().substring(effectIndex)}`;
  }
  return fiexdValue;
}

const BILLION = 1000000000;
const MILLION = 1000000;
const THOUSAND = 1000;
export function formatMarketValueForInfo(value?: number | string) {
  if (value) {
    let parseValue = 0;
    if (typeof value === 'string') {
      if (value.startsWith('$')) {
        parseValue = parseFloat(value.substring(1).replaceAll(',', ''));
      } else {
        parseValue = Number.isNaN(parseFloat(value)) ? 0 : parseFloat(value);
      }
    } else {
      parseValue = value;
    }
    if (parseValue >= BILLION) {
      return `${formatMarketValueForFiexd(parseValue / BILLION)}B`;
    }
    if (parseValue >= MILLION) {
      return `${formatMarketValueForFiexd(parseValue / MILLION)}M`;
    }
    if (parseValue >= THOUSAND) {
      return `${formatMarketValueForFiexd(parseValue / THOUSAND)}K`;
    }
    if (parseValue >= 1) {
      return formatMarketValueForFiexd(parseValue);
    }

    return formatDecimalZero(parseValue);
  }
  return '0.00';
}

export function formatLocalDate(date?: string, locale?: string) {
  if (date && date.length > 0) {
    return new Date(date).toLocaleString(locale);
  }
  return '';
}

export function formatMarketUnitPosition(
  unit?: string,
  value?: number | string,
) {
  if (unit?.toLowerCase() === 'sats') {
    return `${value ?? ''} ${unit ?? ''}`;
  }
  return `${unit ?? ''}${value ?? ''}`;
}
