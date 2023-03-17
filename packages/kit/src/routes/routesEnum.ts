import { SendRoutes } from '../views/Send/enums';

export { SendRoutes };
/*
Error: Couldn't find a 'component', 'getComponent' or 'children' prop for the screen 'CreateWallet'. This can happen if you passed 'undefined'. You likely forgot to export your component from the file it's defined in, or mixed up default import and named import when importing.

**** please import enums directly here to avoid errors above ***
 */
/** Modal */
export enum ModalRoutes {
  CreateAccount = 'CreateAccount',
  RecoverAccount = 'RecoverAccount',
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
  Revoke = 'Revoke',
  NFTMarket = 'NFTMarket',
  Overview = 'Overview',
  CurrencySelect = 'CurrencySelect',
  BulkSender = 'BulkSender',
  Market = 'Market',
}

export enum RootRoutes {
  Root = 'root',
  Modal = 'modal',
  Tab = 'tab',
  Onboarding = 'onboarding',
  Account = 'account',
  OnLanding = 'onlanding',
  OnLandingWalletConnect = 'onlanding_wallet_connect',
}
export enum ReceiveTokenRoutes {
  ReceiveToken = 'ReceiveToken',
}
export enum HomeRoutes {
  // InitialTab = 'overview',
  KeyTag = 'KeyTag',
  InitialTab = 'initial',
  Dev = 'dev',
  HomeOnboarding = 'HomeOnboarding',
  FullTokenListScreen = 'FullTokenListScreen',
  ScreenTokenDetail = 'TokenDetailScreen',
  DebugScreen = 'Debug',
  ScreenOnekeyLiteDetail = 'OnekeyLiteDetailScreen',
  ExploreScreen = 'ExploreScreen',
  DAppListScreen = 'DAppListScreen',
  MyDAppListScreen = 'MyDAppListScreen',
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
  MarketDetail = 'MarketDetail',
  Revoke = 'Revoke',
  RevokeRedirect = 'RevokeRedirect',
  NFTMarketStatsList = 'NFTMarketStatsList',
  NFTMarketLiveMintingList = 'NFTMarketLiveMintingList',
  NFTMarketCollectionScreen = 'NFTMarketCollectionScreen',
  NFTPNLScreen = 'NFTPNLScreen',
  OverviewDefiListScreen = 'OverviewDefiListScreen',
  WalletSwitch = 'WalletSwitch',
  BulkSender = 'BulkSender',
}
export enum TabRoutes {
  // Overview = 'overview',
  Home = 'home',
  Swap = 'swap',
  Market = 'market',
  NFT = 'NFT',
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
  BitcoinUsedAddress = 'BitcoinUsedAddress',
}

export enum RecoverAccountModalRoutes {
  RecoverAccountsAdvanced = 'RecoverAccountsAdvanced',
}

export enum ManageNetworkRoutes {
  NetworkAccountSelector = 'NetworkAccountSelector',
  NetworkSelector = 'NetworkSelector',
  Listing = 'Listing',
  AddNetwork = 'AddNetwork',
  CustomNetwork = 'CustomNetwork',
  PresetNetwork = 'PresetNetwork',
  AddNetworkConfirm = 'AddNetworkConfirm',
  SwitchNetwork = 'SwitchNetwork',

  RPCNode = 'RPCNode',
  QuickAdd = 'QuickAdd',
  Sort = 'Sort',
  SwitchRpc = 'SwitchRpc',
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
