function parseExponential(value: number) {
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
  return 0;
}

export function formatMarketValueForFiexd(
  value?: number,
  fractionDigits?: number,
) {
  if (value) {
    return fractionDigits ? value.toFixed(fractionDigits) : value.toFixed(2);
  }
  return 0;
}

const BILLION = 1000000000;
const MILLION = 1000000;
export function formatMarketValueForMillionAndBillion(value?: number) {
  if (value) {
    if (value >= BILLION) {
      return `${(value / BILLION).toFixed(3)}B`;
    }
    if (value >= MILLION) {
      return `${(value / MILLION).toFixed(3)}M`;
    }
    return value;
  }
  return 0;
}

export function formatLocalDate(date?: string) {
  if (date && date.length > 0) {
    return new Date(date).toLocaleString();
  }
  return '';
}
