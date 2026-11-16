import type { IEarnWithdrawType } from '@onekeyhq/shared/types/staking';

type ICheckAmountRequestKeyParams = {
  accountId?: string;
  expectedAccountAddress?: string;
  amount: string;
  identity?: string;
  inputTokenAddress?: string;
  networkId?: string;
  outputTokenAddress?: string;
  provider?: string;
  protocolVault?: string;
  slippage?: number;
  symbol?: string;
  withdrawAll: boolean;
  withdrawType?: IEarnWithdrawType;
};

type ILatestCheckAmountRequestParams = {
  latestRequestId: number;
  latestRequestKey: string;
  requestId: number;
  requestKey: string;
  requestScope?: object;
  latestRequestScope?: object;
};

export function getCheckAmountRequestKey(params: ICheckAmountRequestKeyParams) {
  return JSON.stringify(params);
}

export function isLatestCheckAmountRequest({
  latestRequestId,
  latestRequestKey,
  requestId,
  requestKey,
  requestScope,
  latestRequestScope,
}: ILatestCheckAmountRequestParams) {
  return (
    requestId === latestRequestId &&
    requestKey === latestRequestKey &&
    (requestScope === undefined || requestScope === latestRequestScope)
  );
}
