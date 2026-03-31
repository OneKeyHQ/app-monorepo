export const PerpTestIDs = {
  // -- Settings --
  HeaderSettingsButton: 'perp-header-settings-button',
  MobileSettingsButton: 'perp-mobile-settings-button',

  // -- Market selector --
  TokenSelector: 'perp-token-selector',
  TokenSelectorMobile: 'perp-token-selector-mobile',
  TokenSelectorSearch: 'perp-token-selector-search',

  // -- Trading form: margin & leverage --
  MarginModeSelector: 'perp-margin-mode-selector',
  LeverageSelector: 'perp-leverage-selector',

  // -- Trading form: order type --
  OrderTypeSelector: 'perp-order-type-selector',
  OrderTypeMarketTab: 'perp-order-type-market-tab',
  OrderTypeLimitTab: 'perp-order-type-limit-tab',
  OrderTypeTriggerTab: 'perp-order-type-trigger-tab',

  // -- Trading form: price inputs --
  PriceInput: 'perp-price-input',
  TriggerPriceInput: 'perp-trigger-price-input',
  ExecutionPriceInput: 'perp-execution-price-input',
  BBOToggleButton: 'perp-bbo-toggle-button',

  // -- Trading form: size input --
  SizeInput: 'perp-size-input',
  SizeSlider: 'perp-size-slider',

  // -- Trading form: TP/SL --
  TpslCheckbox: 'perp-tpsl-checkbox',
  TpInput: 'perp-tp-input',
  SlInput: 'perp-sl-input',
  TriggerReduceOnlyCheckbox: 'perp-trigger-reduce-only-checkbox',

  // -- Trading buttons: side toggle + place order --
  TradeSideToggle: 'perp-trade-side-toggle',
  LongButton: 'perp-long-button',
  ShortButton: 'perp-short-button',
  PlaceOrderButton: 'perp-place-order-button',
  EnableTradingButton: 'perp-enable-trading-button',
  ConnectWalletButton: 'perp-connect-wallet-button',

  // -- Deposit --
  DepositButton: 'perp-deposit-button',
  MobileDepositButton: 'perp-trading-form-mobile-deposit-button',

  // -- Order info panel tabs --
  PositionsTab: 'perp-positions-tab',
  OpenOrdersTab: 'perp-open-orders-tab',
  TradesHistoryTab: 'perp-trades-history-tab',
  AccountTab: 'perp-account-tab',

  // -- Positions list --
  PositionRow: 'perp-position-row',
  PositionCloseMarketButton: 'perp-position-close-market-button',
  PositionCloseLimitButton: 'perp-position-close-limit-button',
  PositionSetTpslButton: 'perp-position-set-tpsl-button',
  PositionShareButton: 'perp-position-share-button',
  PositionAdjustMarginButton: 'perp-position-adjust-margin-button',
  CloseAllPositionsButton: 'perp-close-all-positions-button',

  // -- Open orders list --
  OpenOrderRow: 'perp-open-order-row',
  CancelOrderButton: 'perp-cancel-order-button',
  CancelAllOrdersButton: 'perp-cancel-all-orders-button',

  // -- Close position modal --
  ClosePositionConfirmButton: 'perp-close-position-confirm-button',
  ClosePositionAmountInput: 'perp-close-position-amount-input',
  ClosePositionTypeToggle: 'perp-close-position-type-toggle',

  // -- Set TP/SL modal --
  SetTpslConfirmButton: 'perp-set-tpsl-confirm-button',

  // -- Close all positions modal --
  CloseAllConfirmButton: 'perp-close-all-confirm-button',

  // -- Cancel all orders modal --
  CancelAllConfirmButton: 'perp-cancel-all-confirm-button',

  // -- Leverage adjust modal --
  LeverageInput: 'perp-leverage-input',
  LeverageSlider: 'perp-leverage-slider',
  LeverageConfirmButton: 'perp-leverage-confirm-button',

  // -- Mobile market footer --
  FooterLongButton: 'perp-footer-long-button',
  FooterShortButton: 'perp-footer-short-button',

  // -- Mobile candle chart button --
  CandleChartButton: 'perp-candle-chart-button',

  // -- Portfolio --
  PortfolioButton: 'perp-portfolio-button',

  // -- Activity center --
  ActivityCenterButton: 'perp-activity-center-button',

  // -- Guide --
  GuideButton: 'perp-guide-button',

  // -- Hyperliquid terms --
  TermsConfirmationSlide: 'hyperliquid-intro-confirmation-slide',

  // -- Android market footer (kept for backwards compat) --
  PageFooterCancel: 'page-footer-cancel',
  PageFooterConfirm: 'page-footer-confirm',
} as const;
