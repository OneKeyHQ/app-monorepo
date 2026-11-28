import type { IFuseResultMatch } from '../src/modules3rdParty/fuse';

export interface IDiscoveryHomePageData {
  banners: IDiscoveryBanner[];
  categories: ICategory[];
  trending: IDApp[];
  hot?: IDApp[];
}

export interface IDiscoveryBanner {
  bannerId: string;
  src: string;
  href: string;
  hrefType: 'internal' | 'external';
  rank: number;
  useSystemBrowser: boolean;
  title?: string;
  theme?: 'light' | 'dark';
  isAd?: boolean;
  takeEffect?: {
    start: number;
    end: number;
    platform: string[];
    deleted: boolean;
  };
}

export interface ICategory {
  categoryId: string;
  name: string;
  dapps: IDApp[];
  origin?: string;
  recommendIndex?: number;
  recommend?: {
    start: number;
    end: number;
    platform: string[];
    deleted: boolean;
  };
  dappInfo?: {
    information?:
      | string
      | {
          text: string;
          lokaliseKey: string;
          deleted: boolean;
        };
    link?: string;
    showLink?: boolean;
    deleted?: boolean;
  };
}

export interface IDApp {
  dappId: string;
  name: string;
  url: string;
  logo: string;
  originLogo?: string;
  description: string;
  networkIds: string[];
  categories?: ICategory[];
  categoryIds?: string[];
  tagIds?: string[];
  tags: IDAppTag[];
  keyword?: string;
  order?: number;
  origins?: string[];
  _id?: string;
  isExactUrl?: boolean;
  isAd?: boolean;
}

export interface IDAppTag {
  tagId: string;
  name: string;
  type: string;
}

export interface IDiscoveryListParams {
  cursor?: string;
  limit?: number;
  category: string;
  network?: string;
}

export enum ETranslateEngine {
  standard = 'standard',
  ai = 'ai',
}

export enum ETranslateDisplayMode {
  replace = 'replace',
  bilingual = 'bilingual',
}

export enum EHostSecurityLevel {
  High = 'high',
  Medium = 'medium',
  Security = 'security',
  Unknown = 'unknown',
}
export interface IAttackType {
  name: string;
  description: string;
}

export interface IHostSecurityCheckSources {
  name: string;
  riskLevel: EHostSecurityLevel;
}

export interface IHostSecurity {
  host: string;
  level: EHostSecurityLevel;
  attackTypes: IAttackType[];
  phishingSite: boolean;
  checkSources: IHostSecurityCheckSources[];
  alert: string;
  detail?: {
    title: string;
    content: string;
  };
  projectName: string;
  createdAt: string;
  updatedAt?: string;
  dapp?: {
    name: string;
    logo: string;
    description: {
      text: string;
    };
    tags: {
      name: {
        text: string;
        lokaliseKey: string;
        deleted: boolean;
      };
      tagId: string;
      type: 'success' | 'info' | 'critical' | 'warning' | 'default' | undefined;
    }[];
    origins?: {
      name: string;
      logo: string;
    }[];
  };
}

export interface IBrowserHistory {
  id: string;
  title: string;
  url: string;
  createdAt: number;
  logo?: string;
  titleMatch?: IFuseResultMatch;
  urlMatch?: IFuseResultMatch;
}

export interface IBrowserBookmark {
  title: string;
  url: string;
  logo: string | undefined;
  sortIndex: number | undefined;
  titleMatch?: IFuseResultMatch;
  urlMatch?: IFuseResultMatch;
}

export interface IBrowserRiskWhiteList {
  url: string;
}

export enum ESiteMode {
  desktop = 'desktop',
  mobile = 'mobile',
}

export interface IWebTab {
  id: string;
  url: string;
  displayUrl?: string; // URL for address bar display and UI functions (sharing, external browser)
  isActive?: boolean;
  title?: string;
  customTitle?: string;
  favicon?: string;
  thumbnail?: string;
  isBookmark?: boolean;
  isPinned?: boolean;
  pinnedTimestamp?: number;
  loading?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  refReady?: boolean;
  timestamp?: number;
  siteMode?: ESiteMode;
  type?: 'normal' | 'home';
}

export interface IWebTabsAtom {
  tabs: IWebTab[];
  keys: string[];
}
