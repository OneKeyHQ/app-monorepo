import {
  ESwapSlippageValidationStatus,
  getSwapSlippageValidationStatus,
} from './swapSlippageUtils';

describe('getSwapSlippageValidationStatus', () => {
  it.each([
    [-0.01, ESwapSlippageValidationStatus.ERROR],
    [0, ESwapSlippageValidationStatus.WILL_FAIL],
    [0.09, ESwapSlippageValidationStatus.WILL_FAIL],
    [0.1, ESwapSlippageValidationStatus.NORMAL],
    [10, ESwapSlippageValidationStatus.NORMAL],
    [10.01, ESwapSlippageValidationStatus.WILL_AHEAD],
    [50, ESwapSlippageValidationStatus.WILL_AHEAD],
    [50.01, ESwapSlippageValidationStatus.ERROR],
  ])('classifies %s as %s', (value, status) => {
    expect(getSwapSlippageValidationStatus(value)).toBe(status);
  });
});
