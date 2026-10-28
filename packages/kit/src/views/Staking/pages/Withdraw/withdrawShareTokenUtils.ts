import type {
  IEarnToken,
  IEarnTokenInfo,
  IEarnWithdrawType,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

function matchesShareToken(token: IEarnToken | undefined, address?: string) {
  return Boolean(
    address &&
    token?.address &&
    token.address.toLowerCase() === address.toLowerCase() &&
    !token.isNative &&
    token.symbol &&
    Number.isInteger(token.decimals) &&
    token.decimals >= 0,
  );
}

export function resolveWithdrawShareToken({
  accountId,
  networkId,
  provider,
  protocolInfo,
  tokenInfo,
  initialAmount,
  withdrawType,
}: {
  accountId: string;
  networkId: string;
  provider: string;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
  initialAmount?: string;
  withdrawType?: IEarnWithdrawType;
}): {
  ready: boolean;
  tokenInfo: IEarnTokenInfo | undefined;
  initialAmount: string | undefined;
  balance?: string;
} {
  if (
    withdrawType === 'cancel' ||
    protocolInfo?.withdrawApprove?.amountUnit !== 'shares'
  ) {
    return { ready: true, tokenInfo, initialAmount };
  }

  const shareAddress = protocolInfo.withdrawApprove.tokenAddress;
  const originalMatches = matchesShareToken(tokenInfo?.token, shareAddress);
  const actionData = protocolInfo.withdrawAction?.data;
  const actionToken =
    actionData && 'token' in actionData ? actionData.token : undefined;
  const actionReceipt =
    actionToken && 'info' in actionToken ? actionToken : undefined;
  const actionMatches = matchesShareToken(actionReceipt?.info, shareAddress);
  let receiptToken = originalMatches ? tokenInfo?.token : undefined;
  if (actionMatches) {
    receiptToken = actionReceipt?.info;
  }

  if (!receiptToken) {
    return { ready: false, tokenInfo: undefined, initialAmount: undefined };
  }

  const balance =
    (actionMatches && actionData && 'balance' in actionData
      ? actionData.balance
      : undefined) ??
    protocolInfo.maxUnstakeAmount ??
    protocolInfo.activeBalance ??
    (originalMatches ? tokenInfo?.balanceParsed : undefined) ??
    '0';
  const price =
    (receiptToken === actionReceipt?.info ? actionReceipt?.price : undefined) ??
    (originalMatches ? tokenInfo?.price : undefined) ??
    '0';

  return {
    ready: true,
    balance,
    initialAmount: originalMatches ? initialAmount : undefined,
    tokenInfo: {
      networkId,
      accountId,
      provider,
      vault: protocolInfo.vault,
      indexedAccountId: tokenInfo?.indexedAccountId,
      nativeToken: tokenInfo?.nativeToken,
      token: receiptToken,
      balanceParsed: balance,
      price,
    },
  };
}
