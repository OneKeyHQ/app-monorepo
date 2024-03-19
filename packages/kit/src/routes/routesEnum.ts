/*
Error: Couldn't find a 'component', 'getComponent' or 'children' prop for the screen 'CreateWallet'. This can happen if you passed 'undefined'. You likely forgot to export your component from the file it's defined in, or mixed up default import and named import when importing.

**** please import enums directly here to avoid errors above ***
 */

// GlobalRoutes ----------------------------------------------
/*

window.$navigationRef.current.navigate('main',{screen:'tab',params:{screen:'me',params:{screen:'AddressBook'}}});

window.$navigationRef.current.navigate('main',{screen:'tab',params:{screen:'home',params:{screen:'BulkSender'}}});

window.$navigationRef.current.navigate('main',{screen:'tab',params:{screen:'home',params:{screen:'tab-home'}}});

 */
export enum RootRoutes {
  Main = 'main',

  Modal = 'modal',
  Onboarding = 'onboarding',
  Account = 'account',
  OnLanding = 'onlanding',
  OnLandingWalletConnect = 'onlanding_wallet_connect',
  Gallery = 'gallery',
}

export enum MainRoutes {
  Tab = 'tab',
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
}

export enum HomeRoutes {
  //  **** Home Tab
  ScreenTokenDetail = 'TokenDetailScreen',
  FullTokenListScreen = 'FullTokenListScreen',
  Revoke = 'Revoke',
  RevokeRedirect = 'RevokeRedirect',
  RevokeRedirect2 = 'RevokeRedirect2',
  OverviewDefiListScreen = 'OverviewDefiListScreen',
  BulkSender = 'BulkSender',

  // **** NFT Tab
  NFTPNLScreen = 'NFTPNLScreen',

  // ****  Me Tab
  ScreenOnekeyLiteDetail = 'OnekeyLiteDetailScreen',
  Protected = 'Protected',
  WalletSwitch = 'WalletSwitch',
  VolumeHaptic = 'VolumeHaptic',
  CloudBackup = 'CloudBackup',
  CloudBackupPreviousBackups = 'CloudBackupPreviousBackups',
  CloudBackupDetails = 'CloudBackupDetails',
  PushNotification = 'PushNotification',
  PushNotificationManagePriceAlert = 'PushNotificationManagePriceAlert',
  PushNotificationManageAccountDynamic = 'PushNotificationManageAccountDynamic',
  ClearCache = 'ClearCache',
  AdvancedSettings = 'AdvancedSettings',
  HardwareBridgeSettings = 'HardwareBridgeSettings',

  // **** Discover Tab
  ExploreScreen = 'ExploreScreen',
  DAppListScreen = 'DAppListScreen',
  // **** Swap Tab
  SwapHistory = 'SwapHistory',

  // **** Market Tab
  MarketDetail = 'MarketDetail',
}

// GalleryRoutes ----------------------------------------------

export enum GalleryRoutes {
  Components = 'components',
  ComponentApproval = 'component/approval',
  ComponentSearchBar = 'component/searchBar',
  ComponentTextarea = 'component/textarea',
  ComponentAddress = 'component/address',
  ComponentInput = 'component/input',
  ComponentCard = 'component/card',
  ComponentTypography = 'component/typography',
  ComponentNFTImage = 'component/nftimage',
  ComponentToken = 'component/token',
  ComponentTheme = 'component/theme',
  ComponentIcon = 'component/icon',
  ComponentBadge = 'component/badge',
  ComponentMenu = 'component/menu',
  ComponentList = 'component/List',
  ComponentAlert = 'component/alert',
  ComponentButton = 'component/button',
  ComponentIconButton = 'component/icon-button',
  ComponentSelect = 'component/select',
  ComponentShadow = 'component/shadow',
  ComponentEmpty = 'component/empty',
  ComponentToast = 'component/toast',
  ComponentAccount = 'component/account',
  ComponentWalletSelector = 'component/walletSelector',
  ComponentAccountSelector = 'component/accountSelector',
  ComponentCheckbox = 'component/checkbox',
  ComponentSpinner = 'component/spinner',
  ComponentModal = 'component/modal',
  ComponentRadio = 'component/radio',
  ComponentRadioBox = 'component/radio-box',
  ComponentSwitch = 'component/switch',
  ComponentForm = 'component/form',
  ComponentQRCode = 'component/qrcode',
  ComponentMarkdown = 'component/markdown',
  ComponentDialog = 'component/dialog',
  ComponentDappModals = 'component/dappModals',
  ComponentPageActions = 'component/page-actions',
  ComponentSortableList = 'component/sortable-list',
  ComponentTabs = 'component/tabs',
  ComponentSegmentedControl = 'component/segmented-control',
  ComponentReduxMessage = 'component/redux-message',
  ComponentLogger = 'component/logger',
  ComponentFirebase = 'component/firebase',
  ComponentWebview = 'component/webview',
  ComponentPinCode = 'component/pincode',
  ComponentRestfulRequest = 'component/restful-request',
  ComponentImageViewer = 'component/imageViewer',
  ComponentEmojiList = 'component/EmojiList',
  ComponentKeyboard = 'component/Keyboard',
  ComponentContentBox = 'component/ContentBox',
  ComponentAppUpdate = 'component/AppUpdate',
  ComponentSkeleton = 'component/Skeleton',
  ComponentPopover = 'component/Popover',
  ComponentPriceChart = 'component/PriceChart',
  ComponentTypeWriter = 'component/TypeWriter',
  ComponentHomescreen = 'component/homescreen',
  ComponentToggleButtonGroup = 'component/ToggleButtonGroup',
  ComponentCollapse = 'component/Collapse',
  ComponentDotMap = 'component/DotMap',
  ComponentBottomSheetModal = 'component/BottomSheetModal',
  ComponentNavHeaderGallery = 'component/NavHeader',
  ComponentMnemonicCardGallery = 'component/MnemonicCard',
  ComponentSlider = 'component/Slider',
  ComponentInAppNotification = 'component/InAppNotification',
  ComponentDeepFresh = 'component/deepRefresh',
}

// ModalRoutes ----------------------------------------------

export enum ModalRoutes {
  CreateAccount = 'CreateAccount',
  RecoverAccount = 'RecoverAccount',
  CreateWallet = 'CreateWallet',
  BackupWallet = 'BackupWallet',
  ManagerWallet = 'ManagerWallet',
  ManagerAccount = 'ManagerAccount',
  WalletViewMnemonics = 'WalletViewMnemonics',
  ManageConnectedSites = 'ManageConnectedSites',
  Monitor = 'Monitor',
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
  ClearCache = 'ClearCache',
  CoinControl = 'CoinControl',
  GasPanel = 'GasPanel',
  Inscribe = 'Inscribe',
  Webln = 'Webln',
  Nostr = 'Nostr',
  InscriptionControl = 'InscriptionControl',
}

export { SendModalRoutes } from '../views/Send/enums';

export enum ReceiveTokenModalRoutes {
  ReceiveToken = 'ReceiveToken',
  CreateInvoice = 'CreateInvoice',
  ReceiveInvoice = 'ReceiveInvoice',
}

export enum CreateAccountModalRoutes {
  CreateAccountForm = 'CreateAccountForm',
  CreateAccountAuthentication = 'CreateAccountAuthentication',
  RecoverySelectChainList = 'RecoverySelectChainList',
  RecoverAccountsList = 'RecoverAccountList',
  RecoverAccountsAdvanced = 'RecoverAccountsAdvanced',
  RecoverAccountsConfirm = 'RecoverAccountsConfirm',
  RecoverAccountsConfirmAuthentication = 'RecoverAccountsConfirmAuthentication',
  BulkCopyAddresses = 'BulkCopyAddresses',
  FetchAddressModal = 'FetchAddressModal',
  ExportAddresses = 'ExportAddresses',
  BitcoinUsedAddress = 'BitcoinUsedAddress',
}

export enum RecoverAccountModalRoutes {
  RecoverAccountsAdvanced = 'RecoverAccountsAdvanced',
  BulkCopyAddresses = 'BulkCopyAddresses',
  BitcoinUsedAddress = 'BitcoinUsedAddress',
}

export enum ManageNetworkModalRoutes {
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
  AllNetworksNetworkSelector = 'AllNetworksNetworkSelector',
  AllNetworksAccountsDetail = 'AllNetworksAccountsDetail',
  AllNetworksSupportedNetworks = 'AllNetworksSupportedNetworks',
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

export enum TransactionDetailModalRoutes {
  HistoryDetailModal = 'HistoryDetailModal',
  UtxoDetailModal = 'UtxoDetailModal',
}

export enum SubmitRequestModalRoutes {
  SubmitRequestModal = 'SubmitRequestModal',
}

export enum CollectiblesModalRoutes {
  CollectionModal = 'CollectionModal',
  NFTDetailModal = 'NFTDetailModal',
}

export enum FiatPayModalRoutes {
  SupportTokenListModal = 'SupportTokenList',
}

export enum BackupWalletModalRoutes {
  BackupWalletOptionsModal = 'BackupWalletOptionsModal',
  BackupWalletManualModal = 'BackupWalletManualModal',
  BackupWalletLiteModal = 'BackupWalletLiteModal',
  BackupWalletAttentionsModal = 'BackupWalletAttentionsModal',
  BackupWalletMnemonicModal = 'BackupWalletMnemonicModal',
}

export enum OnekeyHardwareModalRoutes {
  OnekeyHardwareDetailsModal = 'OnekeyHardwareDetailsModal',
  OnekeyHardwareVerifyModal = 'OnekeyHardwareVerifyModal',
  OnekeyHardwareConnectModal = 'OnekeyHardwareConnectModal',
  OnekeyHardwarePinCodeModal = 'OnekeyHardwarePinCodeModal',
  OnekeyHardwareConfirmModal = 'OnekeyHardwareConfirmModal',
  OnekeyDeviceWalletNameModal = 'OnekeyDeviceWalletNameModal',
  OnekeyHardwareDeviceNameModal = 'OnekeyHardwareDeviceNameModal',
  OnekeyHardwareHomeScreenModal = 'OnekeyHardwareHomeScreenModal',
}

export enum OnekeyLiteChangePinModalRoutes {
  OnekeyLiteChangePinInputPinModal = 'OnekeyLiteChangePinInputPinModal',
  OnekeyLiteChangePinSetModal = 'OnekeyLiteChangePinSetModal',
  OnekeyLiteChangePinRepeatModal = 'OnekeyLiteChangePinRepeatModal',
  OnekeyLiteChangePinModal = 'OnekeyLiteChangePinModal',
}

export enum OnekeyLiteResetModalRoutes {
  OnekeyLiteResetModal = 'OnekeyLiteResetModal',
}

export enum HardwareUpdateModalRoutes {
  HardwareUpdateInfoModel = 'HardwareUpdateInfoModel',
  HardwareUpdateWarningModal = 'HardwareUpdateWarningModal',
  HardwareUpdateWarningPowerModal = 'HardwareUpdateWarningPowerModal',
  HardwareUpdatingModal = 'HardwareUpdatingModal',
  HardwareUpdatingBootloaderModal = 'HardwareUpdatingBootloaderModal',
  HardwareUpdateResourceModal = 'HardwareUpdateResourceModal',
}

export enum ImportBackupPasswordModalRoutes {
  ImportBackupPassword = 'ImportBackupPassword',
}

export enum ManagerAccountModalRoutes {
  ManagerAccountModal = 'ManagerAccountModal',
  ManagerAccountExportPrivateModal = 'ManagerAccountExportPrivateModal',
  ManagerAccountExportPublicModal = 'ManagerAccountExportPublicModal',
}

export enum ManagerWalletModalRoutes {
  ManagerWalletModal = 'ManagerWalletModal',
  ManagerWalletAuthorityVerifyModal = 'ManagerWalletAuthorityVerifyModal',
  ManagerWalletModifyNameModal = 'ManagerWalletModifyNameModal',
  ManagerWalletModifyEmojiModal = 'ManagerWalletModifyEmojiModal',
}

export enum UpdateFeatureModalRoutes {
  UpdateFeatureModal = 'UpdateFeatureModal',
  ForcedUpdateModal = 'ForcedUpdateModal',
}

export enum ManageTokenModalRoutes {
  Listing = 'ListTokensModal',
  AddToken = 'AddToken',
  ActivateToken = 'ActivateToken',
  ViewToken = 'ViewToken',
  CustomToken = 'CustomToken',
  VerifiedToken = 'VerifiedToken',
  PriceAlertList = 'PriceAlertList',
  PriceAlertAdd = 'PriceAlertAdd',
  TokenRiskDetail = 'TokenRiskDetail',
}

export enum DappConnectionModalRoutes {
  ConnectionModal = 'ConnectionModal',
  NetworkNotMatchModal = 'NetworkNotMatchModal',
}

export enum ClearCacheModalRoutes {
  ClearCacheModal = 'ClearCacheModal',
  CopyBrowserUrlModal = 'CopyBrowserUrlModal',
}

export enum CoinControlModalRoutes {
  CoinControlModal = 'CoinControlModal',
}

export enum InscribeModalRoutes {
  BRC20Amount = 'BRC20Amount',
  InscribeModal = 'InscribeModal',
  ReceiveAddress = 'ReceiveAddress',
  CreateOrder = 'CreateOrder',
  OrderList = 'OrderList',
  OrderDetail = 'OrderDetail',
  InscribeTransferFromDapp = 'InscribeTransferFromDapp',
}

export enum WeblnModalRoutes {
  MakeInvoice = 'MakeInvoice',
  VerifyMessage = 'VerifyMessage',
  WeblnAuthentication = 'WeblnAuthentication',
}

export enum NostrModalRoutes {
  GetPublicKey = 'GetPublicKey',
  SignEvent = 'SignEvent',
  NostrAuthentication = 'NostrAuthentication',
  ExportPubkey = 'ExportPubkey',
}

export enum InscriptionControlModalRoutes {
  InscriptionControlModal = 'InscriptionControlModal',
}
