import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';

// Local-only diagnostics for the native Discovery home (OK-63713: the Browser
// dashboard sometimes renders blank after returning from another tab or
// closing a modal). Each method logs one link of the render chain so a single
// app-latest.log can tell which link broke. Callers log on change only.
// Never add @LogToServer() here.

export type IDiscoveryHomeDiagLifecycleEvent = 'mount' | 'unmount';

export interface IDiscoveryHomeDiagLayout {
  id: number;
  target: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IDiscoveryHomeDiagBrowserState {
  id: number;
  headerTab: string;
  displayHomePage: boolean;
  showDiscoveryPage: boolean;
  dashboardActive: boolean;
  webPageVisible: boolean;
  rootWebLayerVisible: boolean;
  bottomBarVisible: boolean;
  visibleOuterPages: number[];
  tabCount: number;
  hasActiveTab: boolean;
  useOuterPager: boolean;
  tabletMainView: boolean;
  tabletDetailView: boolean;
  headerSpacerHeight: number;
}

export interface IDiscoveryHomeDiagTabFocus {
  id: number;
  source: 'browser' | 'dashboard';
  isFocus: boolean;
  isHideByModal: boolean;
  currentTab?: string;
}

export interface IDiscoveryHomeDiagPagerState {
  id: number;
  headerTab: string;
  selectedIndex: number;
  activePageIndex: number;
  currentOuterIndex: number;
  transitioning: boolean;
  visiblePagePair: number[] | null;
  dragNeighborPages: number[] | null;
  visitedPages: number[];
  scrollEnabled: boolean;
}

export interface IDiscoveryHomeDiagPagerEvent {
  id: number;
  type: 'pageSelected' | 'scrollState' | 'setPage';
  position?: number;
  state?: string;
  accepted?: boolean;
  activePageIndex: number;
  currentOuterIndex: number;
  lastNativePosition?: number;
  lastNativeOffset?: number;
}

export interface IDiscoveryHomeDiagFocusGate {
  id: number;
  routeFocused: boolean;
  navFocused: boolean;
  isLocked: boolean;
  rootRoutesAtMount: number;
  rootRoutesNow: number;
  rootRouteNames: string[];
  isActive: boolean;
  contentActive: boolean;
  displayHomePage: boolean;
}

export interface IDiscoveryHomeDiagRenderPlan {
  id: number;
  homeDataLoaded: boolean;
  homeDataLoading: boolean | undefined;
  bannerCount: number;
  activeBannerCount: number;
  showBanners: boolean;
  travelMode: boolean;
  trendingCount: number;
  hotCount: number;
  bookmarksLoaded: boolean;
  bookmarkCount: number;
  initialLoading: boolean;
  showDiveIn: boolean;
  showBookmarks: boolean;
  showTrending: boolean;
  reviewControlShow: boolean;
}

export interface IDiscoveryHomeDiagRequest {
  id: number;
  request: 'homePageData' | 'bookmarks' | 'sectionBookmarks';
  phase: 'requested' | 'start' | 'retry' | 'success' | 'error';
  seq?: number;
  trigger?: string;
  gateOpen?: boolean;
  attempt?: number;
  durationMs?: number;
  count?: number;
  bannerCount?: number;
  trendingCount?: number;
  hotCount?: number;
  categoryCount?: number;
  error?: string;
}

export interface IDiscoveryHomeDiagNetwork {
  seq: number;
  phase: 'start' | 'success' | 'error';
  path: string;
  durationMs?: number;
  bannerCount?: number;
  trendingCount?: number;
  hotCount?: number;
  categoryCount?: number;
  error?: string;
}

export interface IDiscoveryHomeDiagWebTab {
  tabId: string;
  isActive: boolean;
  isCurrent: boolean;
  keepAlive: boolean;
  hasBeenShown: boolean;
  mounted: boolean;
  browserContentVisible: boolean;
}

export class DiscoveryHomeDiagnosticsScene extends BaseScene {
  @LogToLocal({ level: 'info' })
  public browserLifecycle(params: {
    id: number;
    event: IDiscoveryHomeDiagLifecycleEvent;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public browserState(params: IDiscoveryHomeDiagBrowserState) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public tabFocus(params: IDiscoveryHomeDiagTabFocus) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public appState(params: { id: number; state: string }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public layout(params: IDiscoveryHomeDiagLayout) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public pagerLifecycle(params: {
    id: number;
    event: IDiscoveryHomeDiagLifecycleEvent;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public pagerState(params: IDiscoveryHomeDiagPagerState) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public pagerEvent(params: IDiscoveryHomeDiagPagerEvent) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public dashboardLifecycle(params: {
    id: number;
    event: IDiscoveryHomeDiagLifecycleEvent;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public dashboardFocusGate(params: IDiscoveryHomeDiagFocusGate) {
    return params;
  }

  // `revealed` / `hidden` come from a layout effect inside the dashboard's
  // DelayedFreeze, so they reflect what React actually committed, not the
  // freeze flag that was requested.
  @LogToLocal({ level: 'info' })
  public dashboardVisibility(params: {
    id: number;
    state: 'revealed' | 'hidden';
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public dashboardRenderPlan(params: IDiscoveryHomeDiagRenderPlan) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public dashboardScroll(params: {
    id: number;
    event: 'scrollEnd' | 'contentSize';
    offsetY?: number;
    width?: number;
    height?: number;
  }) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public dashboardRequest(params: IDiscoveryHomeDiagRequest) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public homePageNetwork(params: IDiscoveryHomeDiagNetwork) {
    return params;
  }

  @LogToLocal({ level: 'info' })
  public webTabContent(params: IDiscoveryHomeDiagWebTab) {
    return params;
  }
}
