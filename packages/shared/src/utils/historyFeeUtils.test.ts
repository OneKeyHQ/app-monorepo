import { getHistoryFeeDisplayValues } from './historyFeeUtils';

describe('getHistoryFeeDisplayValues', () => {
  it('formats a negative net fee as a refund', () => {
    expect(
      getHistoryFeeDisplayValues({
        gasFee: '-0.0008418',
        gasFeeFiatValue: '-0.0012',
      }),
    ).toEqual({
      gasFee: '0.0008418',
      gasFeeFiatValue: '0.0012',
      isRefunded: true,
    });
  });

  it('keeps a regular fee unchanged', () => {
    expect(
      getHistoryFeeDisplayValues({
        gasFee: '0.0008418',
        gasFeeFiatValue: '0.0012',
      }),
    ).toEqual({
      gasFee: '0.0008418',
      gasFeeFiatValue: '0.0012',
      isRefunded: false,
    });
  });

  it('keeps missing fee data unchanged', () => {
    expect(getHistoryFeeDisplayValues({})).toEqual({
      gasFee: undefined,
      gasFeeFiatValue: undefined,
      isRefunded: false,
    });
  });

  it('does not treat negative zero as a refund', () => {
    expect(
      getHistoryFeeDisplayValues({
        gasFee: '-0',
        gasFeeFiatValue: '-0',
      }),
    ).toEqual({
      gasFee: '-0',
      gasFeeFiatValue: '-0',
      isRefunded: false,
    });
  });
});
