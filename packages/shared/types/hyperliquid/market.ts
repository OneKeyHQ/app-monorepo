import type { IHLHex } from './sdk';

// =============================================================================
// Token List and Selector Types
// =============================================================================

export interface IHLTokenListItem {
  readonly coin: string;
  readonly lastPrice: string;
  readonly change24h: string;
  readonly change24hPercent: string;
  readonly funding8h: string;
  readonly volume24h: string;
  readonly openInterest: string;
  readonly markPrice: string;
  readonly indexPrice: string;
  readonly fundingRate: string;
}

export interface IHLTokenSelectorItem extends IHLTokenListItem {
  readonly isPositionActive: boolean;
  readonly hasOpenOrders: boolean;
  readonly positionSize?: string;
  readonly positionPnl?: string;
  readonly positionSide?: 'long' | 'short';
}

// =============================================================================
// Market Summary Types
// =============================================================================

export interface IHLMarketSummary {
  readonly totalVolume24h: string;
  readonly totalOpenInterest: string;
  readonly topGainers: IHLTokenListItem[];
  readonly topLosers: IHLTokenListItem[];
  readonly topVolume: IHLTokenListItem[];
  readonly activeTokensCount: number;
  readonly lastUpdate: number;
}

// =============================================================================
// Ticker Bar Types
// =============================================================================

export interface IHLTickerItem {
  readonly coin: string;
  readonly price: string;
  readonly change24hPercent: string;
  readonly isUp: boolean;
  readonly volume24h: string;
}

export interface IHLTickerBarData {
  readonly items: IHLTickerItem[];
  readonly scrollSpeed: number;
  readonly lastUpdate: number;
}

// =============================================================================
// Trading Pair Types
// =============================================================================

export interface IHLTradingPair {
  readonly symbol: string;
  readonly baseAsset: string;
  readonly quoteAsset: string;
  readonly status: 'active' | 'inactive' | 'halted';
  readonly tickSize: string;
  readonly lotSize: string;
  readonly maxLeverage: number;
  readonly minOrderSize: string;
  readonly maxOrderSize: string;
  readonly makerFee: string;
  readonly takerFee: string;
}

// =============================================================================
// Market Stats Types
// =============================================================================

export interface IHLMarketStats {
  readonly coin: string;
  readonly price24hHigh: string;
  readonly price24hLow: string;
  readonly price24hOpen: string;
  readonly price24hClose: string;
  readonly volume24h: string;
  readonly volumeQuote24h: string;
  readonly trades24h: number;
  readonly openInterest: string;
  readonly openInterestNotional: string;
  readonly fundingRate: string;
  readonly nextFundingTime: number;
  readonly indexPrice: string;
  readonly markPrice: string;
  readonly lastUpdate: number;
}

// =============================================================================
// Price Alert Types
// =============================================================================

export interface IHLPriceAlert {
  readonly id: string;
  readonly coin: string;
  readonly condition: 'above' | 'below';
  readonly targetPrice: string;
  readonly currentPrice: string;
  readonly isActive: boolean;
  readonly createdAt: number;
  readonly triggeredAt?: number;
  readonly description?: string;
}

// =============================================================================
// Watchlist Types
// =============================================================================

export interface IHLWatchlistItem {
  readonly coin: string;
  readonly addedAt: number;
  readonly sortOrder: number;
  readonly tags?: string[];
  readonly notes?: string;
}

export interface IHLWatchlist {
  readonly id: string;
  readonly name: string;
  readonly items: IHLWatchlistItem[];
  readonly isDefault: boolean;
  readonly createdAt: number;
  readonly lastModified: number;
}

// =============================================================================
// Market Heat Map Types
// =============================================================================

export interface IHLHeatMapItem {
  readonly coin: string;
  readonly change24hPercent: string;
  readonly volume24h: string;
  readonly marketCap?: string;
  readonly size: 'small' | 'medium' | 'large';
  readonly color: 'red' | 'green' | 'neutral';
}

export interface IHLHeatMapData {
  readonly items: IHLHeatMapItem[];
  readonly timeframe: '1h' | '4h' | '24h' | '7d';
  readonly lastUpdate: number;
}

// =============================================================================
// Trading View Types
// =============================================================================

export interface IHLTradingViewConfig {
  readonly symbol: string;
  readonly interval: string;
  readonly theme: 'light' | 'dark';
  readonly timezone: string;
  readonly studies: string[];
  readonly showToolbar: boolean;
  readonly showVolumePane: boolean;
}

// =============================================================================
// Market Filter Types
// =============================================================================

export interface IHLMarketFilter {
  readonly minVolume24h?: string;
  readonly maxVolume24h?: string;
  readonly minPrice?: string;
  readonly maxPrice?: string;
  readonly minChange24h?: string;
  readonly maxChange24h?: string;
  readonly categories?: string[];
  readonly searchQuery?: string;
  readonly sortBy: 'volume' | 'price' | 'change' | 'name' | 'openInterest';
  readonly sortOrder: 'asc' | 'desc';
}

// =============================================================================
// Market News Types
// =============================================================================

export interface IHLMarketNews {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly url: string;
  readonly publishedAt: number;
  readonly source: string;
  readonly relatedCoins: string[];
  readonly sentiment: 'positive' | 'negative' | 'neutral';
  readonly importance: 'low' | 'medium' | 'high';
}

// =============================================================================
// Type Guards
// =============================================================================

export function isHLTokenListItem(item: any): item is IHLTokenListItem {
  return (
    item &&
    typeof item.coin === 'string' &&
    typeof item.lastPrice === 'string' &&
    typeof item.change24hPercent === 'string'
  );
}

export function isHLMarketStats(stats: any): stats is IHLMarketStats {
  return (
    stats &&
    typeof stats.coin === 'string' &&
    typeof stats.price24hHigh === 'string' &&
    typeof stats.volume24h === 'string'
  );
}

export function isHLPriceAlert(alert: any): alert is IHLPriceAlert {
  return (
    alert &&
    typeof alert.id === 'string' &&
    typeof alert.coin === 'string' &&
    ['above', 'below'].includes(alert.condition)
  );
}
