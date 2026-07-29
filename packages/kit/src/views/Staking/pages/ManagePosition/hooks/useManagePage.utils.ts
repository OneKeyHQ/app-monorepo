import {
  EApproveType,
  type EManagePositionType,
  type IEarnManagePageResponse,
  type IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

export function buildManagePageRequestKey({
  accountId,
  indexedAccountId,
  networkId,
  symbol,
  provider,
  vault,
  type,
  reserveAddress,
  marketAddress,
}: {
  accountId: string;
  indexedAccountId?: string;
  networkId: string;
  symbol: string;
  provider: string;
  vault?: string;
  type: EManagePositionType;
  reserveAddress?: string;
  marketAddress?: string;
}) {
  return JSON.stringify([
    accountId,
    indexedAccountId ?? '',
    networkId,
    symbol,
    provider,
    vault ?? '',
    type,
    reserveAddress ?? '',
    marketAddress ?? '',
  ]);
}

export function shouldBlockManagePageAction({
  hasManagePageData,
  isStaleData,
  isLoading,
  hasProtocolSwitch,
}: {
  hasManagePageData: boolean;
  isStaleData: boolean;
  isLoading: boolean;
  hasProtocolSwitch: boolean;
}) {
  return Boolean(
    hasManagePageData && (isStaleData || (hasProtocolSwitch && isLoading)),
  );
}

function normalizeApproveType(approveType?: string): EApproveType {
  if (approveType === EApproveType.Permit) {
    return EApproveType.Permit;
  }
  return EApproveType.Legacy;
}

export function buildManagePageApproveInfo({
  approve,
  approveAsset,
  approveTarget,
}: Pick<
  IEarnManagePageResponse,
  'approve' | 'approveAsset' | 'approveTarget'
>): IProtocolInfo['approve'] | undefined {
  const resolvedApproveTarget = approve?.approveTarget ?? approveTarget;
  if (!resolvedApproveTarget) {
    return undefined;
  }

  return {
    allowance: approve?.allowance ?? '0',
    approveType: normalizeApproveType(approve?.approveType),
    approveAsset: approve?.approveAsset ?? approveAsset,
    approveTarget: resolvedApproveTarget,
  };
}
