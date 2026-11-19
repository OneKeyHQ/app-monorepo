import BigNumber from 'bignumber.js';

export function validateAmountInput(text: string, decimal?: number) {
  const regex = new RegExp(
    `^$|^0(\\.\\d{0,${decimal ?? 6}})?$|^[1-9]\\d*(\\.\\d{0,${
      decimal ?? 6
    }})?$|^[1-9]\\d*\\.$|^0\\.$`,
  );
  if (!regex.test(text)) {
    return false;
  }
  return true;
}

export function validateAmountInputForStaking(text: string, decimal?: number) {
  // Matches: empty | 0 | 0.xxx | [1-9]xxx | [1-9]xxx.xxx | [1-9]xxx. | 0. | .xxx
  // Does NOT match leading zeros like "0099" (same as validateAmountInput but also supports ".xxx")
  const regex = new RegExp(
    `^$|^0(\\.\\d{0,${decimal ?? 6}})?$|^[1-9]\\d*(\\.\\d{0,${
      decimal ?? 6
    }})?$|^[1-9]\\d*\\.$|^0\\.$|^\\.\\d{0,${decimal ?? 6}}$`,
  );
  if (!regex.test(text)) {
    return false;
  }
  return true;
}

// A leading dot starts a fraction: "." reads as "0." and ".5" as "0.5". The
// amount forms keep only numbers, and "." alone isn't one, so it would drop
export function fillLeadingZero(text: string) {
  return text.startsWith('.') ? `0${text}` : text;
}

// An amount a form starts on, as typing it would leave the box: empty when
// typing it wouldn't be taken, or before the decimals to check it with are in
export function getStartAmount(text?: string, decimal?: number) {
  if (!text || decimal === undefined) {
    return '';
  }
  const value = fillLeadingZero(text);
  if (
    !validateAmountInputForStaking(value, decimal) ||
    new BigNumber(value).isNaN()
  ) {
    return '';
  }
  return value;
}
