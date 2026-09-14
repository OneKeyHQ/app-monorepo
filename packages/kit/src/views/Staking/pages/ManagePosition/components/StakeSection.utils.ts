import type { IBorrowApproveTarget } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/types';
import { EApproveType } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

export function resolveStakeInitialAllowanceTarget({
  borrowSupplyApproveTarget,
  approveType,
  spenderAddress,
  token,
}: {
  borrowSupplyApproveTarget?: IBorrowApproveTarget;
  approveType?: EApproveType;
  spenderAddress?: string;
  token?: IToken;
}) {
  if (borrowSupplyApproveTarget?.token) {
    return {
      approveType: EApproveType.Legacy,
      spenderAddress: borrowSupplyApproveTarget.spenderAddress,
      token: borrowSupplyApproveTarget.token,
    };
  }

  return {
    approveType,
    spenderAddress,
    token,
  };
}
