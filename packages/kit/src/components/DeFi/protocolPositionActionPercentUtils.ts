import { includes, toNumber } from 'lodash';

const VALID_PERCENT_RE = /^(0|[1-9]\d{0,2})$/;
const DIGIT_RE = /^\d$/;
const NON_DIGIT_RE = /\D/g;
const LEADING_ZERO_RE = /^0+(?=\d)/;
const MAX_PERCENT = 100;
const BACKSPACE_KEY = 'Backspace';
const ZERO_PERCENT = '0';
const HUNDRED_PREFIX = '10';
const HUNDRED_PERCENT = '100';
const THREE_DIGIT_VALUES = ['', '1', HUNDRED_PREFIX, HUNDRED_PERCENT];

function isProtocolPositionActionPercentDigit(value?: string) {
  return !!value && DIGIT_RE.test(value);
}

export function normalizeProtocolPositionActionPercentInput(value: string) {
  const digits = value.replace(NON_DIGIT_RE, '');
  if (!digits) return '';

  const normalizedDigits = digits.replace(LEADING_ZERO_RE, '');
  return String(toNumber(normalizedDigits));
}

export function resolveProtocolPositionActionPercentInput({
  currentValue,
  nextValue,
}: {
  currentValue: string;
  nextValue: string;
}) {
  const normalizedValue =
    normalizeProtocolPositionActionPercentInput(nextValue);
  if (
    normalizedValue !== '' &&
    !validateProtocolPositionActionPercentInput(normalizedValue)
  ) {
    return currentValue;
  }
  return normalizedValue;
}

export function resolveProtocolPositionActionPercentKeyPress({
  currentValue,
  key,
}: {
  currentValue: string;
  key?: string;
}) {
  if (currentValue === ZERO_PERCENT) {
    if (key === BACKSPACE_KEY) return '';
    if (isProtocolPositionActionPercentDigit(key)) return key;
  }
  if (currentValue === HUNDRED_PREFIX) {
    if (key === BACKSPACE_KEY) return '1';
    if (key === ZERO_PERCENT) {
      return HUNDRED_PERCENT;
    }
    if (isProtocolPositionActionPercentDigit(key)) return currentValue;
  }
  return undefined;
}

export function getProtocolPositionActionPercentInputMaxLength(value: string) {
  return includes(THREE_DIGIT_VALUES, value) ? 3 : 2;
}

export function validateProtocolPositionActionPercentInput(value: string) {
  return (
    value === '' ||
    (VALID_PERCENT_RE.test(value) && toNumber(value) <= MAX_PERCENT)
  );
}

export function resolveProtocolPositionActionPercentValue(value: string) {
  return value !== '' && validateProtocolPositionActionPercentInput(value)
    ? toNumber(value)
    : 0;
}

export function shouldClearProtocolPositionActionInitialPercentValue({
  value,
  hasUserIntent,
}: {
  value: string;
  hasUserIntent: boolean;
}) {
  return !hasUserIntent && value === HUNDRED_PERCENT;
}
