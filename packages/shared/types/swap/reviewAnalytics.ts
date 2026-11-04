export type ISwapReviewAnalyticsContext = {
  reviewSessionId: string;
  quoteId?: string;
  // Only the service build ID; never a provider ID or a synthetic quote ID.
  orderId?: string;
};

export type ISwapReviewStage =
  | 'balanceCheck'
  | 'buildTx'
  | 'approveTx'
  | 'prepareTx'
  | 'estimateFee';

export type ISwapReviewCloseReason = 'user' | 'focusLost' | 'reviewChanged';

export type ISwapReviewOpen = Omit<ISwapReviewAnalyticsContext, 'orderId'> & {
  swapProvider: string;
  swapType: string;
  sourceChain: string;
  receivedChain: string;
  sourceTokenSymbol: string;
  receivedTokenSymbol: string;
  createFrom: string;
  walletType: string;
  supportPreBuild: boolean;
  needApprove: boolean;
  openDelayMs: number;
};

export type ISwapReviewReady = ISwapReviewAnalyticsContext &
  Partial<Record<`${ISwapReviewStage}Ms`, number>> & {
    status: 'ready' | 'error' | 'fallback';
    supportPreBuild: boolean;
    totalMs: number;
    failedStage?: ISwapReviewStage;
    message?: string;
  };

export type ISwapReviewConfirm = ISwapReviewAnalyticsContext & {
  sinceOpenMs: number;
  sinceReadyMs?: number;
};

export type ISwapReviewClose = Omit<ISwapReviewAnalyticsContext, 'orderId'> & {
  closeStage: 'loading' | 'ready' | 'error';
  closeReason: ISwapReviewCloseReason;
  sinceOpenMs: number;
};
