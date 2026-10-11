import { getInviteEarningsState } from './getInviteEarningsState';

describe('getInviteEarningsState', () => {
  it('collapses when both 待发放 and 累计 are zero', () => {
    expect(
      getInviteEarningsState({
        distributed: '0',
        undistributed: '0.00',
      }),
    ).toEqual({
      isZero: true,
      undistributed: '0.00',
      distributed: '0.00',
      cumulative: '0.00',
    });
    expect(getInviteEarningsState(undefined).isZero).toBe(true);
    expect(getInviteEarningsState(null).isZero).toBe(true);
  });

  it('sums 已发放 and 待发放 into 累计', () => {
    expect(
      getInviteEarningsState({
        distributed: '4409.70',
        undistributed: '239.35',
      }),
    ).toEqual({
      isZero: false,
      undistributed: '239.35',
      distributed: '4409.70',
      cumulative: '4649.05',
    });
  });

  it('stays expanded when only one side has a balance', () => {
    const distributedOnly = getInviteEarningsState({
      distributed: '12.5',
      undistributed: '0',
    });
    expect(distributedOnly.isZero).toBe(false);
    expect(distributedOnly.cumulative).toBe('12.50');

    const pendingOnly = getInviteEarningsState({
      distributed: '',
      undistributed: 'invalid',
    });
    expect(pendingOnly).toMatchObject({
      isZero: true,
      undistributed: '0.00',
      distributed: '0.00',
      cumulative: '0.00',
    });
  });
});
