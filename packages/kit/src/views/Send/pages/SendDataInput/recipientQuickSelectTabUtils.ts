export type IRecipientQuickSelectTab = 'recent' | 'account' | 'addressBook';

export type IRecipientTabMatchStatus = Record<
  IRecipientQuickSelectTab,
  boolean | null
>;

const TAB_SWITCH_ORDER: IRecipientQuickSelectTab[] = [
  'recent',
  'account',
  'addressBook',
];

export function getAutoSwitchRecipientTab({
  isSearchMode,
  trimmedSearchKey,
  activeTab,
  tabMatchStatus,
  lastManualSwitchSearchKey,
}: {
  isSearchMode?: boolean;
  trimmedSearchKey: string;
  activeTab: IRecipientQuickSelectTab;
  tabMatchStatus: IRecipientTabMatchStatus;
  lastManualSwitchSearchKey?: string;
}) {
  if (!isSearchMode || !trimmedSearchKey) {
    return undefined;
  }

  // If current tab has matches or hasn't reported yet, don't switch.
  if (tabMatchStatus[activeTab] !== false) {
    return undefined;
  }

  // Don't auto-switch if user manually switched tabs and hasn't typed again.
  if (lastManualSwitchSearchKey === trimmedSearchKey) {
    return undefined;
  }

  return TAB_SWITCH_ORDER.find(
    (tab) => tab !== activeTab && tabMatchStatus[tab] === true,
  );
}
