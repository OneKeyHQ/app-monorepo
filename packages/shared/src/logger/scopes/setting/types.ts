import type { ESettingsTabNames } from '../../../routes/setting';

export type ISettingsEntrySurface =
  | 'mobileHome'
  | 'flatRoot'
  | 'categoryPage'
  | 'sidebar'
  | 'search'
  | 'moreActions'
  | 'universalSearch';

export type ISettingsAnalyticsLayout = 'mobile' | 'sidebar' | 'flat';

export type ISettingCategoryOpenedSource = Extract<
  ISettingsEntrySurface,
  'mobileHome' | 'flatRoot' | 'sidebar' | 'moreActions'
>;

export interface ISettingsOpenedParams {
  layout: ISettingsAnalyticsLayout;
}

export interface ISettingCategoryOpenedParams {
  category: ESettingsTabNames;
  source: ISettingCategoryOpenedSource;
}

export interface ISettingItemClickedParams {
  itemId: string;
  category: ESettingsTabNames;
  source: ISettingsEntrySurface;
  searchQueryLength?: number;
  searchResultIndex?: number;
}

export interface ISettingValueChangedParams {
  itemId: string;
  from: string;
  to: string;
}

export interface ISettingsSearchedParams {
  queryLength: number;
  resultCount: number;
  topResultId: string | null;
  layout: ISettingsAnalyticsLayout;
}
