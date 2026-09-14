export const BorrowTestIDs = {
  // --- Home Page ---
  sectionTabs: 'borrow-section-tabs',
  mobileSupplyBtn: 'borrow-mobile-supply-btn',
  mobileBorrowBtn: 'borrow-mobile-borrow-btn',
  mobileEmptyState: 'borrow-mobile-empty-state',
  reservesErrorState: 'borrow-reserves-error-state',
  reservesRetryBtn: 'borrow-reserves-retry-btn',
  positionCard: (kind: 'supplied' | 'borrowed', reserveAddress: string) =>
    `borrow-position-card-${kind}-${reserveAddress.toLowerCase()}`,

  // --- Overview ---
  overviewRefreshBtn: 'borrow-overview-refresh-btn',
  overviewHistoryBtn: 'borrow-overview-history-btn',
  overviewClaimRewardsBtn: 'borrow-overview-claim-rewards-btn',
  overviewHealthFactor: 'borrow-overview-health-factor',
  overviewHealthFactorInfoBtn: 'borrow-overview-health-factor-info-btn',
  overviewNetApy: 'borrow-overview-net-apy',
  overviewEModeCell: 'borrow-overview-emode-cell',
  overviewBonusInfoBtn: 'borrow-overview-bonus-info-btn',

  // --- Supply Card ---
  supplyCard: 'borrow-supply-card',
  supplyZeroBalanceSwitch: 'borrow-supply-zero-balance-switch',
  supplyTableList: 'borrow-supply-table-list',

  // --- Supplied Card ---
  suppliedCollateralSwitch: 'borrow-supplied-collateral-switch',
  collateralConfirmBtn: 'borrow-collateral-confirm-btn',

  // --- Borrow Card ---
  borrowCard: 'borrow-borrow-card',
  borrowTableList: 'borrow-borrow-table-list',

  // --- Manage Position ---
  amountInput: 'borrow-amount-input',
  actionConfirmBtn: 'borrow-action-confirm-btn',

  // --- E-Mode Need Action ---
  eModeNeedActionConfirmBtn: 'borrow-e-mode-need-action-confirm-btn',
  eModeNeedActionGetFundsBtn: 'borrow-e-mode-need-action-get-funds-btn',
  eModeNeedActionShortfallCard: 'borrow-e-mode-need-action-shortfall-card',
  eModeNeedActionSwitchIcon: 'borrow-e-mode-need-action-switch-icon',

  // --- Claim Rewards Dialog ---
  claimItemBtn: 'borrow-claim-item-btn',
  claimAllBtn: 'borrow-claim-all-btn',
  unclaimableItemBtn: 'borrow-unclaimable-item-btn',

  // --- Asset Select Popover ---
  assetSelectRow: 'borrow-asset-select-row',

  // --- Borrow Action ---
  borrowActionBtn: 'borrow-action-btn',
  marketSelect: 'borrow-market-select',

  // --- History ---
  historyFilterSelect: 'borrow-history-filter-select',
  historyListItem: 'borrow-history-list-item',
} as const;
