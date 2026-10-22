import type {
  IEarnToken,
  IEarnTokenInfo,
  IEarnWithdrawType,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

/**
 * 校验份额元数据与服务端授权资产相同，空地址、原生币或无效精度均不可用于份额输入。
 * 地址按现有 Earn ERC20 资产匹配规则忽略大小写，不通过修改地址或 symbol 冒充份额。
 */
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

/**
 * 为独立赎回页确认份额资产、价格和余额；取消请求或未声明 shares 时保留原入口信息。
 * 优先使用服务端赎回按钮的元数据，缺失时只接受地址相同的原 tokenInfo。
 * 原入口资产不同则丢弃预填数量；无法确认份额身份时返回 ready=false，禁止报价与提交。
 */
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
