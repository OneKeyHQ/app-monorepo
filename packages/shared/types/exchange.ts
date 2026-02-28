/**
 * Binance supported assets response.
 * Key: networkId (e.g., "evm--56", "evm--1")
 * Value: Record of symbol -> asset config
 */
export type IBinanceSupportedAssets = Record<
  string,
  Record<string, { withdrawEnable: boolean }>
>;

export interface IBinancePreOrderResponse {
  orderId: string;
  externalOrderId: string;
  redirectUrl: string;
  linkExpireTime: number;
  withdrawWalletAddress: string;
}

export interface IBinancePreOrderParams {
  networkId: string;
  address: string;
  cryptoCurrency: string;
  requestedAmount?: string;
}

export interface IExchangeFilter {
  exchangeId: string;
  supportedAssets: IBinanceSupportedAssets;
}
