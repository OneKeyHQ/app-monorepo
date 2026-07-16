import type { ReactNode } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

export const HOME_CONTAINER_SCHEMA_VERSION = 1;

export const HOME_CONTAINER_TAB_IDS = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
] as const;

export type IHomeContainerTabId = (typeof HOME_CONTAINER_TAB_IDS)[number];

export type IHomeContainerFooterSlotId = 'support' | 'upgrade';

export type IHomeContainerSlotKey =
  | 'header.account-row'
  | 'header.action-row'
  | 'header.balance'
  | `content.footer.${IHomeContainerTabId}.${IHomeContainerFooterSlotId}`
  | `content.header.${IHomeContainerTabId}`
  | `content.state.${IHomeContainerTabId}`
  | `tab.accessory.${IHomeContainerTabId}`;

export type IHomeContainerSlotInteraction = 'none' | 'tap';

export interface IHomeContainerSlot {
  content: ReactNode;
  interaction?: IHomeContainerSlotInteraction;
}

export type IHomeContainerItemRenderer =
  | 'action'
  | 'addToken'
  | 'asset'
  | 'card'
  | 'defi'
  | 'earn'
  | 'empty'
  | 'history'
  | 'loading'
  | 'market'
  | 'marketTabs'
  | 'nft'
  | 'perps'
  | 'showMore'
  | 'supportAction'
  | 'supportPromo'
  | 'toggle'
  | 'upgrade';

export type IHomeContainerActionIcon =
  | 'buy'
  | 'copy'
  | 'filter'
  | 'manage'
  | 'more'
  | 'receive'
  | 'send';

export interface IHomeContainerTheme {
  backgroundColor: string;
  cardColor: string;
  hoverColor?: string;
  activeColor?: string;
  subduedIconColor?: string;
  dividerColor: string;
  primaryTextColor: string;
  secondaryTextColor: string;
  accentColor: string;
  positiveColor: string;
  negativeColor: string;
}

export interface IHomeContainerAction {
  id: string;
  title: string;
  subtitle?: string;
  icon?: IHomeContainerActionIcon;
  iconUrl?: string;
  actionId: string;
}

export interface IHomeContainerBanner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  actionId?: string;
  dismissActionId?: string;
}

export interface IHomeContainerSegment {
  id: string;
  title: string;
  imageUrl?: string;
  leadingIcon?: 'star';
  iconOnly?: boolean;
  selected?: boolean;
  actionId: string;
}

export interface IHomeContainerHeader {
  accountName: string;
  accountSubtitle?: string;
  accountImageUrl?: string;
  accountActionId?: string;
  copyActionId?: string;
  networkName?: string;
  networkImageUrls?: string[];
  networkCount?: number;
  networkActionId?: string;
  balance: string;
  balanceSecondary?: string;
  balanceActionId?: string;
  balanceActions?: IHomeContainerAction[];
  actions: IHomeContainerAction[];
  banners: IHomeContainerBanner[];
}

export interface IHomeContainerItem {
  id: string;
  renderer: IHomeContainerItemRenderer;
  title: string;
  subtitle?: string;
  subtitleDetail?: string;
  subtitleDetailColor?: string;
  value?: string;
  detail?: string;
  imageUrl?: string;
  imageUrls?: string[];
  secondaryImageUrl?: string;
  titleAccessoryImageUrl?: string;
  titleAccessoryIcon?: 'gas';
  badge?: string;
  badges?: string[];
  badgeImageUrl?: string;
  communityRecognized?: boolean;
  accentColor?: string;
  buttonTitle?: string;
  leadingIcon?:
    | 'book'
    | 'download'
    | 'lowValue'
    | 'prime'
    | 'risk'
    | 'star'
    | 'support';
  showChevron?: boolean;
  actionId?: string;
  favorite?: boolean;
  favoriteActionId?: string;
  favoriteLabel?: string;
  displayHeight?: number;
  segments?: IHomeContainerSegment[];
}

export interface IHomeContainerSection {
  id: string;
  title?: string;
  actionTitle?: string;
  actionId?: string;
  actionDisabled?: boolean;
  layout?: 'grid' | 'horizontal' | 'list' | 'marketRecommendations';
  items: IHomeContainerItem[];
}

export interface IHomeContainerTab {
  id: IHomeContainerTabId;
  title: string;
  toolbarAction?: IHomeContainerAction;
  sections: IHomeContainerSection[];
}

export interface IHomeContainerSlots {
  backgroundColor?: string;
  accountRow?: IHomeContainerSlot;
  balance?: IHomeContainerSlot;
  headerActionRow?: IHomeContainerSlot;
  contentFooters?: Partial<
    Record<
      IHomeContainerTabId,
      Partial<Record<IHomeContainerFooterSlotId, IHomeContainerSlot>>
    >
  >;
  contentHeaders?: Partial<Record<IHomeContainerTabId, IHomeContainerSlot>>;
  contentStates?: Partial<Record<IHomeContainerTabId, IHomeContainerSlot>>;
  tabAccessories?: Partial<Record<IHomeContainerTabId, IHomeContainerSlot>>;
}

export interface IHomeContainerSnapshot {
  schemaVersion: typeof HOME_CONTAINER_SCHEMA_VERSION;
  revision: number;
  selectedTabId: IHomeContainerTabId;
  header: IHomeContainerHeader;
  tabs: IHomeContainerTab[];
  theme: IHomeContainerTheme;
}

export interface IHomeContainerPatch {
  schemaVersion: typeof HOME_CONTAINER_SCHEMA_VERSION;
  revision: number;
  header?: IHomeContainerHeader;
  tabs: IHomeContainerTabPatch[];
}

export interface IHomeContainerTabPatch {
  tabId: IHomeContainerTabId;
  sections: IHomeContainerSection[];
}

export interface IHomeContainerProps {
  snapshot?: IHomeContainerSnapshot;
  slots?: IHomeContainerSlots;
  style?: StyleProp<ViewStyle>;
  fallback?: ReactNode;
  testID?: string;
  debugOverlayEnabled?: boolean;
  onReady?: (capabilities: IHomeContainerCapabilities) => void;
  onAction?: (actionId: string, itemId: string, tabId: string) => void;
  onRefresh?: (tabId: string, requestId: string) => void;
  onVisibleTabChange?: (tabId: string) => void;
  onRenderError?: (code: string, message: string) => void;
}

export interface IHomeContainerRef {
  setSnapshot: (snapshot: IHomeContainerSnapshot) => void;
  applyPatch: (patch: IHomeContainerPatch) => void;
  completeRefresh: (requestId: string) => void;
  selectTab: (tabId: IHomeContainerTabId, animated?: boolean) => void;
  getCapabilities: () => IHomeContainerCapabilities | undefined;
}

export interface IHomeContainerCapabilities {
  schemaVersions: number[];
  tabIds: IHomeContainerTabId[];
  supportsPatches: boolean;
  supportsAtomicPatches?: boolean;
  supportsNativeRefresh: boolean;
  supportsHorizontalPaging: boolean;
  supportsSlots?: boolean;
}

export function serializeHomeContainerPayload(
  payload: IHomeContainerSnapshot | IHomeContainerPatch,
): string {
  return JSON.stringify(payload);
}
