export type WebSiteHistory = {
  title?: string;
  url?: string;
  favicon?: string;
};

export type DiscoverHistory = {
  webSite?: WebSiteHistory; // 手动输入的普通网站
  clicks: number;
  timestamp: number;
};

export type HistoryItemData = {
  clicks: number;
  timestamp: number;
};

export type DAppItemType = {
  _id: string;
  name: string;
  url: string;
  logoURL: string;
  subtitle: string;
  description: string;
  networkIds: string[];
  tags: { name: string; _id: string }[];
  categories: { name: string; _id: string }[];
};

export type ItemsType = {
  label: string;
  items: DAppItemType[];
};

export interface SectionDataType {
  title: string;
  data: DAppItemType[];
  onItemSelect?: (item: DAppItemType) => void;
}
