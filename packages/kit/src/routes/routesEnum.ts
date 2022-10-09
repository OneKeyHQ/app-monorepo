/*
Error: Couldn't find a 'component', 'getComponent' or 'children' prop for the screen 'CreateWallet'. This can happen if you passed 'undefined'. You likely forgot to export your component from the file it's defined in, or mixed up default import and named import when importing.

**** please import enums directly here to avoid errors above ***
 */
/** Modal */
export enum ModalRoutes {
  CreateAccount = 'CreateAccount',
  CreateWallet = 'CreateWallet',
  BackupWallet = 'BackupWallet',
  ManagerWallet = 'ManagerWallet',
  ManagerAccount = 'ManagerAccount',
  WalletViewMnemonics = 'WalletViewMnemonics',
  ManageConnectedSites = 'ManageConnectedSites',
  // Found screens with the same name nested inside one another. Check:
  //    modal > Send, modal > Send > Send
  Send = 'Send',
  Receive = 'Receive',
  FiatPay = 'FiatPay',
  SubmitRequest = 'SubmitRequest',
  HistoryRequest = 'HistoryRequest',
  TransactionDetail = 'TransactionDetail',
  OnekeyLiteReset = 'OnekeyLiteReset',
  OnekeyLiteChangePinInputPin = 'OnekeyLiteChangePinInputPin',
  DappConnectionModal = 'DappConnectionModal',
  Password = 'Password',
  ManageToken = 'ManageToken',
  Collectibles = 'Collectibles',
  EnableLocalAuthentication = 'EnableLocalAuthentication',
  ManageNetwork = 'ManageNetwork',
  OnekeyHardware = 'OnekeyHardware',
  HardwareUpdate = 'HardwareUpdate',
  Discover = 'Discover',
  Swap = 'Swap',
  ScanQrcode = 'ScanQrcode',
  UpdateFeature = 'UpdateFeature',
  AddressBook = 'AddressBook',
  ImportBackupPassword = 'ImportBackupPassword',
  Staking = 'Staking',
  PushNotification = 'PushNotification',
  Webview = 'Webview',
}

export enum RootRoutes {
  Root = 'root',
  Modal = 'modal',
  Tab = 'tab',
  Onboarding = 'onboarding',
  Account = 'account',
  OnLanding = 'onlanding',
}
export enum ReceiveTokenRoutes {
  ReceiveToken = 'ReceiveToken',
}
export enum HomeRoutes {
  // InitialTab = 'overview',
  InitialTab = 'initial',
  Dev = 'dev',
  HomeOnboarding = 'HomeOnboarding',
  FullTokenListScreen = 'FullTokenListScreen',
  ScreenTokenDetail = 'TokenDetailScreen',
  DebugScreen = 'Debug',
  SettingsWebviewScreen = 'SettingsWebviewScreen',
  ScreenOnekeyLiteDetail = 'OnekeyLiteDetailScreen',
  ExploreScreen = 'ExploreScreen',
  DAppListScreen = 'DAppListScreen',
  TransactionHistoryScreen = 'TransactionHistoryScreen',
  Protected = 'Protected',
  AddressBook = 'AddressBook',
  SwapHistory = 'SwapHistory',
  VolumeHaptic = 'VolumeHaptic',
  CloudBackup = 'CloudBackup',
  CloudBackupPreviousBackups = 'CloudBackupPreviousBackups',
  CloudBackupDetails = 'CloudBackupDetails',
  PushNotification = 'PushNotification',
  PushNotificationManagePriceAlert = 'PushNotificationManagePriceAlert',
  PushNotificationManageAccountDynamic = 'PushNotificationManageAccountDynamic',
}
export enum TabRoutes {
  // Overview = 'overview',
  Home = 'home',
  Swap = 'swap',
  Discover = 'discover',
  Me = 'me',
  Developer = 'developer',
  Send = 'send',
  Receive = 'receive',
}

export enum CreateAccountModalRoutes {
  CreateAccountForm = 'CreateAccountForm',
  CreateAccountAuthentication = 'CreateAccountAuthentication',
  RecoverySelectChainList = 'RecoverySelectChainList',
  RecoverAccountsList = 'RecoverAccountList',
  RecoverAccountsAdvanced = 'RecoverAccountsAdvanced',
  RecoverAccountsConfirm = 'RecoverAccountsConfirm',
  RecoverAccountsConfirmAuthentication = 'RecoverAccountsConfirmAuthentication',
}

export enum ManageNetworkRoutes {
  NetworkAccountSelector = 'NetworkAccountSelector',
  Listing = 'Listing',
  AddNetwork = 'AddNetwork',
  CustomNetwork = 'CustomNetwork',
  PresetNetwork = 'PresetNetwork',
  AddNetworkConfirm = 'AddNetworkConfirm',
  SwitchNetwork = 'SwitchNetwork',
}

export enum CreateWalletModalRoutes {
  ConnectHardwareModal = 'ConnectHardwareModal',
  AppWalletDoneModal = 'AppWalletDoneModal',
  SetupSuccessModal = 'SetupSuccessModal',
  SetupHardwareModal = 'SetupHardwareModal',
  SetupNewDeviceModal = 'SetupNewDeviceModal',
  DeviceStatusCheckModal = 'DeviceStatusCheckModal',
  RestoreHardwareWalletModal = 'RestoreHardwareWalletModal',
  RestoreHardwareWalletDescriptionModal = 'RestoreHardwareWalletDescriptionModal',

  CreateWatchedAccount = 'CreateWatchedAccount',
  CreateImportedAccount = 'CreateImportedAccount',

  // Onekey Lite backup
  OnekeyLiteRestorePinCodeVerifyModal = 'OnekeyLiteRestorePinCodeVerifyModal',
  OnekeyLiteRestoreModal = 'OnekeyLiteRestoreModal',
  OnekeyLiteRestoreDoneModal = 'OnekeyLiteRestoreDoneModal',
  OnekeyLiteBackupPinCodeVerifyModal = 'OnekeyLiteBackupPinCodeVerifyModal',
  OnekeyLiteBackupModal = 'OnekeyLiteBackupModal',

  AddExistingWalletModal = 'AddExistingWalletModal',
  AddImportedOrWatchingAccountModal = 'AddImportedOrWatchingAccountModal',
  AddImportedAccountDoneModal = 'AddImportedAccountDoneModal',
  AttentionsModal = 'AttentionsModal',
  MnemonicModal = 'MnemonicModal',
  NewWalletModal = 'NewWalletModal',

  WalletConnectQrcodeModal = 'WalletConnectQrcodeModal',
}
