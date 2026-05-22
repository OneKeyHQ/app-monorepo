type IPerpsEnableTradingRealCanTradeStatus =
  | {
      accountAddress?: string | null;
      details?: {
        activatedOk?: boolean | null;
        agentOk?: boolean | null;
        abstractionOk?: boolean | null;
        builderFeeOk?: boolean | null;
        internalRebateBoundOk?: boolean | null;
        referralCodeOk?: boolean | null;
      };
    }
  | undefined;

export function getPerpsEnableTradingRealCanTrade(
  status: IPerpsEnableTradingRealCanTradeStatus,
) {
  return Boolean(
    status?.accountAddress &&
    status?.details?.agentOk &&
    status?.details?.builderFeeOk &&
    status?.details?.referralCodeOk &&
    status?.details?.activatedOk &&
    status?.details?.internalRebateBoundOk &&
    status?.details?.abstractionOk,
  );
}
