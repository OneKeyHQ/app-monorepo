import { EApproveType } from '@onekeyhq/shared/types/staking';

import { resolveBorrowApprovalType } from './borrowApproval.utils';

describe('resolveBorrowApprovalType', () => {
  it('normalizes unsupported Permit metadata to the Borrow ERC20 path', () => {
    expect(resolveBorrowApprovalType(EApproveType.Permit)).toBe(
      EApproveType.Legacy,
    );
  });

  it('preserves Legacy and absent approval metadata', () => {
    expect(resolveBorrowApprovalType(EApproveType.Legacy)).toBe(
      EApproveType.Legacy,
    );
    expect(resolveBorrowApprovalType(undefined)).toBeUndefined();
  });
});
