export type IHomeNativeTabKey = 'portfolio' | 'defi' | 'nft' | 'history';

export type IHomeNativeRowBase = {
  key: string;
  estimatedHeight?: number;
  accessibilityLabel?: string;
};

export type IHomeNativeSectionHeaderRow = IHomeNativeRowBase & {
  type: 'sectionHeader';
  title: string;
};

export type IHomeNativeTextRow = IHomeNativeRowBase & {
  type: 'text';
  title: string;
  subtitle?: string;
};

export type IHomeNativeTokenRow = IHomeNativeRowBase & {
  type: 'token';
  tokenKey: string;
  symbol: string;
  name: string;
  iconUri?: string;
  balance: string;
  fiatValue: string;
  price?: string;
  change24h?: string;
  change24hColor?: 'positive' | 'negative' | 'neutral';
  networkName?: string;
};

export type IHomeNativeHistoryRow = IHomeNativeRowBase & {
  type: 'history';
  txId: string;
  title: string;
  subtitle: string;
  value: string;
  status: 'pending' | 'success' | 'failed' | 'unknown';
};

export type IHomeNativeEmptyRow = IHomeNativeRowBase & {
  type: 'empty';
  title: string;
  description?: string;
};

export type IHomeNativeLoadingRow = IHomeNativeRowBase & {
  type: 'loading';
  rows?: number;
};

export type IHomeNativeRnSlotRow = IHomeNativeRowBase & {
  type: 'rnSlot';
  slotId: string;
  reuse: 'never';
};

export type IHomeNativeRow =
  | IHomeNativeSectionHeaderRow
  | IHomeNativeTextRow
  | IHomeNativeTokenRow
  | IHomeNativeHistoryRow
  | IHomeNativeEmptyRow
  | IHomeNativeLoadingRow
  | IHomeNativeRnSlotRow;

export type IHomeNativeTab = {
  key: IHomeNativeTabKey;
  title: string;
  enabled: boolean;
  badge?: boolean;
};

export type IHomeNativeSchema = {
  version: 1;
  schemaId: string;
  activeTabKey: IHomeNativeTabKey;
  tabs: IHomeNativeTab[];
  rowsByTab: Record<IHomeNativeTabKey, IHomeNativeRow[]>;
  refreshingByTab: Partial<Record<IHomeNativeTabKey, boolean>>;
  hasMoreByTab: Partial<Record<IHomeNativeTabKey, boolean>>;
  tabBar: {
    variant: 'pill';
    showSettingsButton: boolean;
  };
};

export type IHomeNativeTabChangeEvent = {
  tabKey: string;
  source: 'tap' | 'swipe' | 'programmatic';
};

export type IHomeNativeRowEvent = {
  tabKey: string;
  rowKey: string;
  rowType: string;
  action?: string;
};

export type IHomeNativeRefreshEvent = {
  tabKey: string;
};

export type IHomeNativeEndReachedEvent = {
  tabKey: string;
  itemCount: number;
};

export type IHomeNativeVisibleRowsEvent = {
  tabKey: string;
  rowKeysJson: string;
};

export type IHomeNativeErrorEvent = {
  code: string;
  message: string;
};
