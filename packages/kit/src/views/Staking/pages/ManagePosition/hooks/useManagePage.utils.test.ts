import { EApproveType } from '@onekeyhq/shared/types/staking';

import { buildManagePageApproveInfo } from './useManagePage.utils';

describe('useManagePage utils', () => {
  it('maps top-level approveTarget into protocol approve info', () => {
    expect(
      buildManagePageApproveInfo({
        approveTarget: '0xpool',
      }),
    ).toEqual({
      allowance: '0',
      approveType: EApproveType.Legacy,
      approveTarget: '0xpool',
    });
  });

  it('keeps nested approve object compatible with existing providers', () => {
    expect(
      buildManagePageApproveInfo({
        approveTarget: '0xpool',
        approve: {
          allowance: '2',
          approveType: EApproveType.Permit,
          approveTarget: '0xpermit-target',
        },
      }),
    ).toEqual({
      allowance: '2',
      approveType: EApproveType.Permit,
      approveTarget: '0xpermit-target',
    });
  });
});
