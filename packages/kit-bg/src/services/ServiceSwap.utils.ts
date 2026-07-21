import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export function buildPerpDepositOrderStatusRequestParams(params: {
  networkId: string;
  txId: string;
  isArbUSDCToken: boolean;
  toPerpDepositTokenAddress?: string;
  receivingAddress: string;
  orderId?: string;
}) {
  return {
    networkId: params.networkId,
    txId: params.txId,
    isArbUSDCToken: params.isArbUSDCToken,
    toPerpDepositTokenAddress: params.toPerpDepositTokenAddress,
    receivedAddress: params.receivingAddress,
    ...(params.orderId ? { orderId: params.orderId } : {}),
  };
}

export function buildSwapRequestErrorToastPayload(error?: {
  message?: string;
  requestId?: string;
}) {
  return {
    diagnosticText: error?.requestId
      ? `RequestId: ${error.requestId}`
      : undefined,
    method: 'error' as const,
    requestId: error?.requestId,
    title: error?.message ?? 'Request failed',
  };
}

export function normalizeSwapTokenListCurrency({
  tokens,
  currency,
}: {
  tokens: ISwapToken[];
  currency: string;
}) {
  return tokens.map((token) => {
    if (!token.price && !token.fiatValue) {
      return token;
    }

    return {
      ...token,
      currency,
    };
  });
}
