import BigNumber from 'bignumber.js';

export const getFormattedNumber = (
  number: number | string | BigNumber,
  options?: {
    decimal?: number;
    fullPrecision?: boolean;
    roundingMode?: BigNumber.RoundingMode;
  },
) => {
  const {
    decimal = 7,
    fullPrecision = false,
    roundingMode = BigNumber.ROUND_FLOOR,
  } = options ?? {};
  try {
    const numberBN = new BigNumber(number);

    if (numberBN.isNaN() || !numberBN.isFinite()) {
      return null;
    }

    if (typeof decimal === 'number') {
      if (fullPrecision) {
        return numberBN.toFormat(decimal, roundingMode);
      }
      return numberBN.decimalPlaces(decimal, roundingMode).toFormat();
    }

    return numberBN.toFormat();
  } catch {
    return null;
  }
};
