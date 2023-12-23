export interface IDiscoveryHomePageData {
  banners: IDiscoveryBanner[];
  categories: ICategory[];
}

export interface IDiscoveryBanner {
  _id: string;
  src: string;
  href: string;
  hrefType: string;
  rank: number;
  useSystemBrowser: boolean;
}

export interface ICategory {
  id: string;
  name: string;
  dapps: IDApp[];
}

export interface IDApp {
  _id: string;
  dappradarId: string;
  name: string;
  url: string;
  logo: string;
  originLogo: string;
  description: string;
  networkIds: string[];
  categories: IDAppCategory[];
  tags: IDAppTag[];
}

interface IDAppCategory {
  id: string;
  name: string;
}

export interface IDAppTag {
  id: string;
  name: string;
  color: string;
}

export interface IDiscoveryListParams {
  cursor?: string;
  limit?: number;
  category: string;
  network?: string;
}
