import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EApproveType,
  type EManagePositionType,
  type IEarnManagePageResponse,
  type IProtocolInfo,
  type IStakeEarnDetail,
} from '@onekeyhq/shared/types/staking';

/**
 * Restore receipt withdrawal metadata from protocol details when manage-page
 * omits it, so the form cannot treat shares as the deposited asset. Other
 * flows keep their existing metadata. Only reuse details fetched within one
 * minute; missing configuration or load failures block the incomplete form.
 */
export async function resolveManagePageWithdrawApprove({
  managePageData,
  vault,
  detailCacheEntry,
  loadDetail,
}: {
  managePageData: IEarnManagePageResponse;
  vault?: string;
  detailCacheEntry?: { data: IStakeEarnDetail; updatedAt: number };
  loadDetail: () => Promise<IStakeEarnDetail>;
}): Promise<IProtocolInfo['withdrawApprove']> {
  const configured = managePageData.withdrawApprove;
  const receiptAddress =
    managePageData.withdraw?.data?.token?.info.address?.toLowerCase();
  const depositToken = managePageData.deposit?.data?.token?.info;
  if (
    configured ||
    managePageData.buy ||
    managePageData.sell ||
    !vault ||
    !depositToken ||
    receiptAddress !== vault.toLowerCase() ||
    receiptAddress === depositToken.address.toLowerCase()
  ) {
    return configured;
  }

  const age = detailCacheEntry
    ? Date.now() - detailCacheEntry.updatedAt
    : undefined;
  const cachedApprove = detailCacheEntry?.data.withdrawApprove;
  const isValid = (approve: IProtocolInfo['withdrawApprove']) =>
    approve?.amountUnit === 'shares' &&
    Boolean(approve.approveTarget) &&
    approve.tokenAddress?.toLowerCase() === receiptAddress;
  if (age !== undefined && age >= 0 && age < 60_000 && isValid(cachedApprove)) {
    return cachedApprove;
  }

  const approve = (await loadDetail()).withdrawApprove;
  if (!isValid(approve)) {
    throw new OneKeyLocalError('Receipt token withdrawal approval is missing');
  }
  return approve;
}

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
    allowance: approve?.allowance,
    approveType: normalizeApproveType(approve?.approveType),
    approveAsset: approve?.approveAsset ?? approveAsset,
    approveTarget: resolvedApproveTarget,
  };
}
