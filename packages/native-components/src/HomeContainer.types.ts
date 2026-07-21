import type { ReactNode } from 'react';

import type {
  IHomeContainerPatchEnvelopeV3,
  IHomeContainerSnapshotEnvelopeV3,
} from './HomeContainerProtocolV3';
import type { StyleProp, ViewStyle } from 'react-native';

export const HOME_CONTAINER_SCHEMA_VERSION = 2;
export const HOME_CONTAINER_PROTOCOL_VERSION = 2;
export const HOME_CONTAINER_SLOT_CONTRACT_REVISION = 1;

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

export type IHomeContainerNavigationTab = Omit<IHomeContainerTab, 'sections'>;

export interface IHomeContainerSnapshotPayload {
  selectedTabId: IHomeContainerTabId;
  header: IHomeContainerHeader;
  tabs: IHomeContainerTab[];
  theme: IHomeContainerTheme;
}

export type IHomeContainerChange =
  | { kind: 'replaceShell'; value: IHomeContainerHeader }
  | {
      kind: 'replaceNavigation';
      value: {
        selectedTabId: IHomeContainerTabId;
        tabs: IHomeContainerNavigationTab[];
      };
    }
  | {
      kind: 'replaceSection';
      tabId: IHomeContainerTabId;
      sectionId: string;
      index: number;
      value: IHomeContainerSection;
    }
  | {
      kind: 'removeSection';
      tabId: IHomeContainerTabId;
      sectionId: string;
    }
  | { kind: 'replaceSurface'; value: IHomeContainerTheme };

export interface IHomeContainerSnapshotEnvelope {
  kind: 'snapshot';
  protocolVersion: typeof HOME_CONTAINER_PROTOCOL_VERSION;
  schemaVersion: typeof HOME_CONTAINER_SCHEMA_VERSION;
  owner: IHomeContainerOwner;
  revision: number;
  payload: IHomeContainerSnapshotPayload;
}

export interface IHomeContainerPatchEnvelope {
  kind: 'patch';
  protocolVersion: typeof HOME_CONTAINER_PROTOCOL_VERSION;
  schemaVersion: typeof HOME_CONTAINER_SCHEMA_VERSION;
  owner: IHomeContainerOwner;
  baseRevision: number;
  revision: number;
  changes: IHomeContainerChange[];
}

export type IHomeContainerTransportPayload =
  | IHomeContainerSnapshot
  | IHomeContainerPatch
  | IHomeContainerSnapshotEnvelope
  | IHomeContainerPatchEnvelope
  | IHomeContainerSnapshotEnvelopeV3
  | IHomeContainerPatchEnvelopeV3;

export type IHomeContainerTransportResult =
  | {
      kind: 'applied' | 'duplicate';
      owner: IHomeContainerOwner;
      revision: number;
    }
  | {
      kind: 'needSnapshot';
      owner?: IHomeContainerOwner;
      currentRevision?: number;
      reason:
        | 'ownerMismatch'
        | 'revisionGap'
        | 'slotRevisionGap'
        | 'invalidInvariant'
        | 'unsupportedSchema'
        | 'unsupportedProtocol';
    };

export interface IHomeContainerTransportSubmission {
  owner: IHomeContainerOwner;
  revision: number;
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
  renderedRevision: number;
  intent: IHomeContainerIntentPayload;
}

export interface IHomeContainerSlotBundle {
  owner: IHomeContainerOwner;
  semanticRevision: number;
  slotContractRevision: number;
  slots: IHomeContainerSlots;
}

export interface IHomeContainerProps {
  snapshot?: IHomeContainerSnapshot;
  slots?: IHomeContainerSlots;
  slotBundle?: IHomeContainerSlotBundle;
  style?: StyleProp<ViewStyle>;
  fallback?: ReactNode;
  testID?: string;
  debugOverlayEnabled?: boolean;
  onReady?: (capabilities: IHomeContainerCapabilities) => void;
  onAction?: (actionId: string, itemId: string, tabId: string) => void;
  onRefresh?: (tabId: string, requestId: string) => void;
  onVisibleTabChange?: (tabId: string) => void;
  onRenderError?: (code: string, message: string) => void;
  onIntent?: (intentJson: string) => void;
  onTransportResult?: (resultJson: string) => void;
}

export interface IHomeContainerRef {
  setSnapshot: (snapshot: IHomeContainerSnapshot) => void;
  applyPatch: (patch: IHomeContainerPatch) => void;
  setProtocolV2Snapshot?: (
    snapshot: IHomeContainerSnapshotEnvelope,
    slots?: IHomeContainerSlots,
  ) => void;
  applyProtocolV2Patch?: (
    patch: IHomeContainerPatchEnvelope,
    slots?: IHomeContainerSlots,
  ) => void;
  setProtocolV3Snapshot?: (
    snapshot: IHomeContainerSnapshotEnvelopeV3,
    slots?: IHomeContainerSlots,
  ) => void;
  applyProtocolV3Patch?: (
    patch: IHomeContainerPatchEnvelopeV3,
    slots?: IHomeContainerSlots,
  ) => void;
  completeRefresh: (requestId: string) => void;
  selectTab: (tabId: IHomeContainerTabId, animated?: boolean) => void;
  getCapabilities: () => IHomeContainerCapabilities | undefined;
}

export interface IHomeContainerCapabilities {
  schemaVersions: number[];
  protocolVersions?: number[];
  preferredProtocol?: number;
  tabIds: IHomeContainerTabId[];
  supportsPatches: boolean;
  supportsAtomicPatches?: boolean;
  supportsNativeRefresh: boolean;
  supportsHorizontalPaging: boolean;
  supportsSlots?: boolean;
}

export function serializeHomeContainerPayload(
  payload: IHomeContainerTransportPayload,
): string {
  return JSON.stringify(payload);
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

function isHomeContainerOwner(value: unknown): value is IHomeContainerOwner {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const owner = value as Partial<IHomeContainerOwner>;
  return (
    typeof owner.scopeKey === 'string' && typeof owner.sessionId === 'string'
  );
}

export function parseHomeContainerTransportResult(
  value: string,
): IHomeContainerTransportResult | undefined {
  try {
    const result = JSON.parse(value) as {
      kind?: unknown;
      owner?: unknown;
      revision?: unknown;
      currentRevision?: unknown;
      reason?: unknown;
    };
    if (result.kind === 'applied' || result.kind === 'duplicate') {
      return isHomeContainerOwner(result.owner) &&
        typeof result.revision === 'number'
        ? (result as IHomeContainerTransportResult)
        : undefined;
    }
    if (result.kind !== 'needSnapshot') {
      return undefined;
    }
    const reasons = [
      'ownerMismatch',
      'revisionGap',
      'slotRevisionGap',
      'invalidInvariant',
      'unsupportedSchema',
      'unsupportedProtocol',
    ] as const;
    if (
      !result.reason ||
      !reasons.some((reason) => reason === result.reason) ||
      (result.owner !== undefined && !isHomeContainerOwner(result.owner)) ||
      (result.currentRevision !== undefined &&
        typeof result.currentRevision !== 'number')
    ) {
      return undefined;
    }
    return result as IHomeContainerTransportResult;
  } catch {
    return undefined;
  }
}

export function isHomeContainerTransportResultForSubmission(
  result: IHomeContainerTransportResult,
  submission: IHomeContainerTransportSubmission | undefined,
): boolean {
  if (!submission) {
    return false;
  }
  if (result.kind === 'needSnapshot') {
    return Boolean(
      result.owner &&
      result.owner.scopeKey === submission.owner.scopeKey &&
      result.owner.sessionId === submission.owner.sessionId,
    );
  }
  return (
    result.revision === submission.revision &&
    result.owner.scopeKey === submission.owner.scopeKey &&
    result.owner.sessionId === submission.owner.sessionId
  );
}
