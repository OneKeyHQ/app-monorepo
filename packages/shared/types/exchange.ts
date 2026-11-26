/**
 * Asset config for one symbol on one network. The deposit fields are absent
 * on payloads that only serve the withdraw flow.
 */
export interface IBinanceSupportedAssetInfo {
  withdrawEnable: boolean;
  // Upstream deposit switch AND the server-side deposit network allowlist.
  depositEnable?: boolean;
  binanceNetwork?: string;
  // Absent for native coins. A deposit create request echoes it verbatim.
  contractAddress?: string;
  requiresAddressTag?: boolean;
}

/**
 * Binance supported assets response.
 * Key: networkId (e.g., "evm--56", "evm--1")
 * Value: Record of symbol -> asset config
 */
export type IBinanceSupportedAssets = Record<
  string,
  Record<string, IBinanceSupportedAssetInfo>
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
