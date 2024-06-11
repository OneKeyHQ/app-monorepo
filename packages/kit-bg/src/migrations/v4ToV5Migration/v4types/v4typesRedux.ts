import type {
  EV4OnekeyDomain,
  EV4ValidationFields,
  IV4LocaleSymbol,
  IV4WalletSwitchItem,
} from './v4typesCommon';

export type IV4SettingsDevModeInfo = {
  enable?: boolean;
  preReleaseUpdate?: boolean;
  updateDeviceBle?: boolean;
  updateDeviceSys?: boolean;
  updateDeviceRes?: boolean;
  enableTestFiatEndpoint?: boolean;
  enableZeroNotificationThreshold?: boolean;
  enablePerfCheck?: boolean;
  defiBuildService?: string;
  hideDiscoverContent?: boolean;
  // eslint-disable-next-line spellcheck/spell-checker
  onRamperTestMode?: boolean;
  showWebEmbedWebviewAgent?: boolean;
  showContentScriptReloadButton?: boolean;
};

export type IV4ReduxSettingsState = {
  theme: 'light' | 'dark' | 'system';
  lastLocale: IV4LocaleSymbol;
  locale: IV4LocaleSymbol;
  version: string;
  buildNumber?: string;
  instanceId: string;
  enableAppLock: boolean;
  enableLocalAuthentication: boolean;
  selectedFiatMoneySymbol: string;
  appLockDuration: number;
  refreshTimeStamp: number;
  autoRefreshTimeStamp: number;
  swapSlippagePercent: string;
  disableSwapExactApproveAmount?: boolean;
  enableHaptics: boolean;
  // eslint-disable-next-line spellcheck/spell-checker
  enableWebAuthn?: boolean;
  disableExt?: boolean;
  disableExtSwitchTips?: boolean;
  // TODO deviceUpdates
  //   deviceUpdates?: Record<
  //     string, // connectId
  //     FirmwareUpdate
  //   >;
  walletSwitchData?: Record<
    string, // networkId + walletName
    IV4WalletSwitchItem
  >;
  devMode?: IV4SettingsDevModeInfo;
  pushNotification?: {
    registrationId?: string;
    threshold: number;
    pushEnable: boolean;
    btcAndEthPriceAlertEnable: boolean;
    favoriteTokensPriceAlertEnable: boolean;
    priceAlertEnable: boolean;
    accountActivityPushEnable: boolean;
  };
  validationSetting?: {
    [EV4ValidationFields.Account]?: boolean;
    [EV4ValidationFields.Payment]?: boolean;
    [EV4ValidationFields.Secret]?: boolean;
    [EV4ValidationFields.Wallet]?: boolean;
  };
  hideSmallBalance?: boolean;
  hideRiskTokens?: boolean;
  putMainTokenOnTop?: boolean;
  hideScamHistory?: boolean;
  includeNFTsInTotal?: boolean;
  hideBalance?: boolean;
  updateSetting?: {
    autoDownload: boolean;
    updateLatestVersion: string | null;
    updateLatestTimeStamp: number | null;
  };
  customNetworkRpcMap?: {
    [networkId: string]: string[];
  };
  accountDerivationDbMigrationVersion?: string;
  hardware?: {
    rememberPassphraseWallets?: string[];
    verification?: Record<string, boolean>; // connectId -> verified
    versions?: Record<string, string>; // connectId -> version
  };
  // TODO softwareUpdate
  //   softwareUpdate?: {
  //     forceUpdateVersionInfo?: VersionInfo;
  //   };
  leftSidebarCollapsed?: boolean;
  enableETH2Unstake?: boolean;
  advancedSettings?: {
    useDustUtxo?: boolean;
  };
  hardwareConnectSrc?: EV4OnekeyDomain;
  gasPanelEIP1559Enabled?: boolean;
  showTokenDetailPriceChart?: boolean;
  hideAllNetworksSelectNetworkTips?: boolean;
  hideInscriptions: Record<string, boolean>; // accountId -> hide
  migrationVersions?: {
    fixBtcPubKey?: string;
  };
};
