/**
 * Types for exchange integration (Binance Connect, etc.)
 */

/**
 * Binance supported assets response
 * Key: networkId (e.g., "evm--56", "evm--1")
 * Value: Record of symbol -> asset config
 */
export type IBinanceSupportedAssets = Record<
  string,
  Record<string, { withdrawEnable: boolean }>
>;

/**
 * Binance pre-order response
 */
export interface IBinancePreOrderResponse {
  orderId: string;
  externalOrderId: string;
  redirectUrl: string;
  linkExpireTime: number;
}

/**
 * Binance pre-order request params
 */
export interface IBinancePreOrderParams {
  networkId: string;
  address: string;
  cryptoCurrency: string;
  requestedAmount: string;
}

/**
 * Exchange filter for token selector
 */
export interface IExchangeFilter {
  exchangeId: string;
  supportedAssets: IBinanceSupportedAssets;
}
