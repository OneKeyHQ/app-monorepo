import type { ListHeadTagType } from './types';

export const SUBMIT_TOKEN_URL = 'https://gr4yl99ujhl.typeform.com/to/ZM0qyr9e';

export const MARKET_FAKE_SKELETON_LIST_ARRAY = new Array(5).fill(null);
export const MARKET_FAKE_SKELETON_CATEGORY_ARRAY = new Array(5).fill(0);

export enum EMarketCellData {
  CollectionStar = 'CollectionStar',
  TokenInfo = 'TokenInfo',
  TokenPrice = 'TokenPrice',
  Token24hChange = 'Token24hChange',
  Token24hVolume = 'Token24hVolume',
  TokenMarketCap = 'TokenMarketCap',
  TokenSparklineChart = 'TokenSparklineChart',
  TokenSwapStatus = 'TokenSwapStatus',
}

export const ListHeadTagsForSearch: ListHeadTagType[] = [
  {
    id: EMarketCellData.TokenInfo,
    title: 'form__name_uppercase',
    minW: '100px',
    textAlign: 'left',
    showVerticalLayout: true,
    showNorMalDevice: true,
  },
  {
    id: EMarketCellData.TokenPrice,
    title: 'form__price_uppercase',
    minW: '100px',
    textAlign: 'right',
    showVerticalLayout: true,
    showNorMalDevice: true,
  },
  {
    id: EMarketCellData.Token24hChange,
    title: 'form__24h%_uppercase',
    minW: '100px',
    textAlign: 'right',
    showVerticalLayout: true,
    showNorMalDevice: true,
  },
];

export const ListHeadTags: ListHeadTagType[] = [
  {
    id: EMarketCellData.CollectionStar,
    minW: '52px',
    textAlign: 'center',
    showVerticalLayout: false,
    showNorMalDevice: true,
  },
  {
    id: EMarketCellData.TokenInfo,
    title: 'form__name_uppercase',
    minW: '100px',
    textAlign: 'left',
    showVerticalLayout: true,
    showNorMalDevice: true,
    dislocation: {
      id: EMarketCellData.TokenMarketCap,
      title: 'form__market_cap_uppercase',
    },
  },
  {
    id: EMarketCellData.TokenPrice,
    title: 'form__price_uppercase',
    minW: '100px',
    textAlign: 'right',
    showVerticalLayout: true,
    showNorMalDevice: true,
  },
  {
    id: EMarketCellData.Token24hChange,
    title: 'form__24h%_uppercase',
    minW: '100px',
    textAlign: 'right',
    showVerticalLayout: true,
    showNorMalDevice: true,
  },
  {
    id: EMarketCellData.TokenMarketCap,
    title: 'form__market_cap_uppercase',
    minW: '130px',
    textAlign: 'right',
    showVerticalLayout: false,
  },
  {
    id: EMarketCellData.Token24hVolume,
    title: 'form__24h_volume_uppercase',
    minW: '120px',
    textAlign: 'right',
    showVerticalLayout: false,
  },
  {
    id: EMarketCellData.TokenSparklineChart,
    title: 'form__last_7_days_uppercase',
    minW: '100px',
    textAlign: 'right',
    showVerticalLayout: false,
  },
  {
    id: EMarketCellData.TokenSwapStatus,
    minW: '100px',
    showVerticalLayout: false,
    showNorMalDevice: true,
  },
];
