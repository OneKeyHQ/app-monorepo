export interface IDiscoveryHomePageData {
  banners: any[]; // TODO: Replace 'any' with a more specific type if possible
  categories: ICategory[];
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
  origin: string;
  recommendIndex: number;
  networkIds: string[];
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
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
