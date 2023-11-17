export const SUBMIT_TOKEN_URL = 'https://gr4yl99ujhl.typeform.com/to/ZM0qyr9e';

export const MARKET_LIST_COLUMN_SHOW_WIDTH_1 = 824;
export const MARKET_LIST_COLUMN_SHOW_WIDTH_2 = 924;
export const MARKET_LIST_COLUMN_SHOW_WIDTH_3 = 1024;
export const MARKET_FAKE_SKELETON_LIST_ARRAY = new Array(5).fill(null);
export const MARKET_FAKE_SKELETON_CATEGORY_ARRAY = new Array(5).fill(0);

export enum EMarketCellData {
  CollectionStarOrSerialNumber = 'CollectionStarOrSerialNumber',
  TokenInfo = 'TokenInfo',
  TokenSwapStatus = 'TokenSwapStatus',
  TokenPrice = 'TokenPrice',
  Token24hChange = 'Token24hChange',
  Token24hVolume = 'Token24hVolume',
  TokenMarketCap = 'TokenMarketCap',
  TokenSparklineChart = 'TokenSparklineChart',
  TokenCollectionStarAndMore = 'TokenCollectionStarAndMore',
}

export const ListHeadTagsForSearch: any[] = [
  {
    id: EMarketCellData.CollectionStarOrSerialNumber,
    minW: '42px',
    textAlign: 'center',
    showVerticalLayout: true,
    isSearch: true,
  },
  {
    id: EMarketCellData.TokenInfo,
    title: 'form__name_uppercase',
    minW: '100px',
    textAlign: 'left',
    showVerticalLayout: true,
    isSearch: true,
  },
  {
    id: EMarketCellData.TokenPrice,
    title: 'form__price_uppercase',
    minW: '100px',
    textAlign: 'right',
    showVerticalLayout: true,
    isSearch: true,
  },
  {
    id: EMarketCellData.Token24hChange,
    title: 'form__24h%_uppercase',
    minW: '100px',
    textAlign: 'right',
    showVerticalLayout: true,
    isSearch: true,
  },
];

export const ListHeadTags: any[] = [
  {
    id: EMarketCellData.CollectionStarOrSerialNumber,
    minW: '32px',
    textAlign: 'left',
    showVerticalLayout: false,
  },
  {
    id: EMarketCellData.TokenInfo,
    title: 'form__name_uppercase',
    minW: '120px',
    textAlign: 'left',
    showVerticalLayout: true,
    dislocation: {
      id: EMarketCellData.TokenMarketCap,
      title: 'form__market_cap_uppercase',
    },
  },
  {
    id: EMarketCellData.TokenSwapStatus,
    minW: '100px',
    showVerticalLayout: false,
  },
  {
    id: EMarketCellData.TokenPrice,
    title: 'form__price_uppercase',
    minW: '100px',
    textAlign: 'right',
    showVerticalLayout: true,
  },
  {
    id: EMarketCellData.Token24hChange,
    title: 'form__24h%_uppercase',
    minW: '70px',
    textAlign: 'right',
    showVerticalLayout: true,
  },
  {
    id: EMarketCellData.TokenMarketCap,
    title: 'form__market_cap_uppercase',
    minW: '130px',
    textAlign: 'right',
    showVerticalLayout: false,
    hide824Width: true,
  },
  {
    id: EMarketCellData.Token24hVolume,
    title: 'form__24h_volume_uppercase',
    minW: '120px',
    textAlign: 'right',
    showVerticalLayout: false,
    hide924Width: true,
    hide824Width: true,
  },
  {
    id: EMarketCellData.TokenSparklineChart,
    title: 'form__last_7_days_uppercase',
    minW: '100px',
    textAlign: 'right',
    showVerticalLayout: false,
    hide924Width: true,
    hide824Width: true,
    hide1024Width: true,
  },
  {
    id: EMarketCellData.TokenCollectionStarAndMore,
    minW: '100px',
    showVerticalLayout: false,
  },
];
