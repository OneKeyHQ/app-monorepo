import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WebSiteHistory } from '../../../store/reducers/discover';
import { DAppItemType } from '../type';

export type WebSiteType = {
  url?: string;
  title?: string;
  favicon?: string;
  historyId?: string;
};
export type HistoryItem = {
  logoURI: string;
  title: string;
  url: string;
};

export type MatchDAppItemType = {
  id: string;
  dapp?: DAppItemType | undefined;
  webSite?: WebSiteHistory | undefined;
  clicks?: number | undefined;
  timestamp?: number | undefined;
};

export type SearchContentType = {
  searchContent: string;
  dapp?: MatchDAppItemType; // don`t search dapp
};

export type SearchViewKeyEventType = 'ArrowUp' | 'ArrowDown';

export type SearchViewProps = {
  visible: boolean;
  searchContent: SearchContentType | undefined;
  relativeComponent: any;
  onVisibleChange?: (visible: boolean) => void;
  onSelectorItem?: (item: MatchDAppItemType) => void;
  onHoverItem?: (item: MatchDAppItemType) => void;
  forwardedRef?: any;
  onKeyPress?: (event: SearchViewKeyEventType) => void;
};

export type WebHandler = 'browser' | 'webview' | 'tabbedWebview';
export const webHandler: WebHandler = (() => {
  if (platformEnv.isWeb || platformEnv.isExtension) {
    return 'browser';
  }
  if (platformEnv.isDesktop) {
    return 'tabbedWebview';
  }
  return 'webview';
})();
