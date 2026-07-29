import type { ReactNode } from 'react';

import type { StyleProp, ViewStyle } from 'react-native';

export const HOME_CONTAINER_TAB_IDS = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
] as const;

export type IHomeContainerTabId = (typeof HOME_CONTAINER_TAB_IDS)[number];

export type IHomeContainerFooterSlotId = 'historyEnd' | 'support' | 'upgrade';

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
  height?: number;
  interaction?: IHomeContainerSlotInteraction;
}

export type IHomeContainerHeaderActionLayout =
  | 'loading'
  | 'standard'
  | 'zeroBalance';

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
  strongColor?: string;
  infoBackgroundColor?: string;
  infoTextColor?: string;
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
  resourceRows?: {
    label: string;
    value: string;
    progress?: number;
  }[];
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
  actionLayout?: IHomeContainerHeaderActionLayout;
  actionRowHeight?: number;
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
  titleAccessoryIcon?: 'gas' | 'question';
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
  showDivider?: boolean;
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

interface IHomeContainerTabBase {
  id: IHomeContainerTabId;
  title: string;
  toolbarAction?: IHomeContainerAction;
  sections: IHomeContainerSection[];
}

export type IHomeContainerTab = IHomeContainerTabBase &
  (
    | { destination: 'inline'; handoffCommandId?: never }
    | {
        destination: 'handoff';
        handoffCommandId: string;
      }
  );

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

export interface IHomeContainerOwner {
  scopeKey: string;
  sessionId: string;
}

export interface IHomeContainerSnapshotPayload {
  selectedTabId: IHomeContainerTabId;
  header: IHomeContainerHeader;
  tabs: IHomeContainerTab[];
  theme: IHomeContainerTheme;
}

export type IHomeContainerSnapshot = IHomeContainerSnapshotPayload;

export interface IHomeContainerState {
  owner: IHomeContainerOwner;
  payload: IHomeContainerSnapshotPayload;
}

export type IHomeContainerIntentPayload =
  | { kind: 'action'; commandId: string; itemId?: string }
  | {
      kind: 'handoff';
      tabId: IHomeContainerTabId;
      commandId: string;
    }
  | { kind: 'refresh'; tabId: IHomeContainerTabId; requestId: string }
  | { kind: 'selectTab'; tabId: IHomeContainerTabId };

export interface IHomeContainerIntent {
  intentId: string;
  owner: IHomeContainerOwner;
  intent: IHomeContainerIntentPayload;
}

export interface IHomeContainerSlotBundle {
  owner: IHomeContainerOwner;
  slots: IHomeContainerSlots;
}

export interface IHomeContainerProps {
  state?: IHomeContainerState;
  slotBundle?: IHomeContainerSlotBundle;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  debugOverlayEnabled?: boolean;
  onRenderError?: (code: string, message: string) => void;
  onIntent?: (intentJson: string) => void;
}

export interface IHomeContainerRef {
  setState: (state: IHomeContainerState) => void;
  completeRefresh: (requestId: string) => void;
  selectTab: (tabId: IHomeContainerTabId, animated?: boolean) => void;
}

export function serializeHomeContainerState(
  state: IHomeContainerState,
): string {
  return JSON.stringify(state);
}

export function isHomeContainerSnapshotInvariantValid(
  snapshot: Pick<IHomeContainerSnapshot, 'selectedTabId' | 'tabs'>,
): boolean {
  const tabIds = new Set<IHomeContainerTabId>();
  for (const tab of snapshot.tabs) {
    if (tabIds.has(tab.id)) return false;
    tabIds.add(tab.id);
    if (tab.destination === 'handoff') {
      if (!tab.handoffCommandId || tab.sections.length > 0) return false;
    } else if (
      tab.destination !== 'inline' ||
      tab.handoffCommandId !== undefined
    ) {
      return false;
    }
  }
  return snapshot.tabs.some(
    (tab) => tab.id === snapshot.selectedTabId && tab.destination === 'inline',
  );
}
