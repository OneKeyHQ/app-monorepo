import {
  EApproveType,
  type IEarnManagePageResponse,
  type IEarnTokenInfo,
} from '@onekeyhq/shared/types/staking';

export function resolveBorrowManageApproveType({
  isBorrowTokenApproval,
  approveType,
}: {
  isBorrowTokenApproval: boolean;
  approveType?: EApproveType;
}): EApproveType | undefined {
  if (isBorrowTokenApproval && approveType) {
    // Borrow currently implements ERC20 approval transactions, not the Earn
    // Permit2 signature flow. Normalize backend Permit metadata to the
    // supported path instead of silently skipping approval.
    return EApproveType.Legacy;
  }
  return approveType;
}

export function resolveBorrowManageTokenInfo({
  action,
  hasSelectedAsset,
  selectedManagePageData,
  fallbackTokenInfo,
}: {
  action?: 'supply' | 'withdraw' | 'borrow' | 'repay';
  hasSelectedAsset: boolean;
  selectedManagePageData?: Pick<IEarnManagePageResponse, 'repay' | 'withdraw'>;
  fallbackTokenInfo?: IEarnTokenInfo;
}): IEarnTokenInfo | undefined {
  if (!hasSelectedAsset) {
    return fallbackTokenInfo;
  }

  let actionData;
  if (action === 'repay') {
    actionData = selectedManagePageData?.repay;
  } else if (action === 'withdraw') {
    actionData = selectedManagePageData?.withdraw;
  }
  const actionToken = actionData?.data?.token;

  if (!fallbackTokenInfo || !actionToken) {
    return undefined;
  }

  return {
    ...fallbackTokenInfo,
    balanceParsed: actionData?.data?.balance ?? '0',
    token: actionToken.info,
    price: actionToken.price,
  };
}
