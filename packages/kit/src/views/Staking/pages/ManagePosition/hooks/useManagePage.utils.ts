import {
  EApproveType,
  type IEarnManagePageResponse,
  type IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

function normalizeApproveType(approveType?: string): EApproveType {
  if (approveType === EApproveType.Permit) {
    return EApproveType.Permit;
  }
  return EApproveType.Legacy;
}

export function buildManagePageApproveInfo({
  approve,
  approveTarget,
}: Pick<IEarnManagePageResponse, 'approve' | 'approveTarget'>):
  | IProtocolInfo['approve']
  | undefined {
  const resolvedApproveTarget = approve?.approveTarget ?? approveTarget;
  if (!resolvedApproveTarget) {
    return undefined;
  }

  return {
    allowance: approve?.allowance ?? '0',
    approveType: normalizeApproveType(approve?.approveType),
    approveTarget: resolvedApproveTarget,
  };
}
