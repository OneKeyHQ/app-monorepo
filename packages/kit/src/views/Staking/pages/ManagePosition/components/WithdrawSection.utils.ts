import {
  EApproveType,
  type IEarnManagePageResponse,
  type IEarnTokenInfo,
} from '@onekeyhq/shared/types/staking';

export type IScopedBorrowManagePageResult = {
  requestKey: string;
  data?: IEarnManagePageResponse;
  failed?: boolean;
};

export async function settleScopedBorrowManagePageRequest({
  requestKey,
  request,
}: {
  requestKey: string;
  request: () => Promise<IEarnManagePageResponse>;
}): Promise<IScopedBorrowManagePageResult> {
  try {
    return {
      requestKey,
      data: await request(),
    };
  } catch {
    // A failed request still owns the current scope. Settling it explicitly
    // ends the loading state without exposing data from the previous asset.
    return {
      requestKey,
      failed: true,
    };
  }
}

export function buildSelectedBorrowManagePageRequestKey({
  accountId,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  action,
}: {
  accountId: string;
  networkId: string;
  provider: string;
  marketAddress?: string;
  reserveAddress?: string;
  action?: 'withdraw' | 'repay';
}) {
  if (
    !accountId ||
    !networkId ||
    !provider ||
    !marketAddress ||
    reserveAddress === undefined ||
    !action
  ) {
    return '';
  }

  return JSON.stringify([
    accountId,
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    action,
  ]);
}

export function resolveScopedBorrowManagePageResult({
  requestKey,
  result,
  isLoading,
}: {
  requestKey: string;
  result?: IScopedBorrowManagePageResult;
  isLoading?: boolean;
}) {
  const isCurrent =
    !!requestKey && !!result && result.requestKey === requestKey;

  return {
    data: isCurrent ? result.data : undefined,
    isPending: !!requestKey && (!isCurrent || !!isLoading),
  };
}

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
