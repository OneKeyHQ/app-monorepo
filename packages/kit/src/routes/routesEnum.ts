/** Modal */
export enum ModalRoutes {
  CreateAccount = 'CreateAccount',
  CreateWallet = 'CreateWallet',
  BackupWallet = 'BackupWallet',
  ManagerWallet = 'ManagerWallet',
  ManagerAccount = 'ManagerAccount',
  WalletViewMnemonics = 'WalletViewMnemonics',
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
  EnableLocalAuthentication = ' EnableLocalAuthentication',
  ManageNetwork = 'ManageNetwork',
  OnekeyHardware = 'OnekeyHardware',
  HardwareUpdate = 'HardwareUpdate',
  Discover = 'Discover',
  Swap = 'Swap',
  ScanQrcode = 'ScanQrcode',
  UpdateFeature = 'UpdateFeature',
  AddressBook = 'AddressBook',
}
export enum DappModalRoutes {
  ConnectionModal = 'ConnectionModal',
}
export enum RootRoutes {
  Root = 'root',
  Modal = 'modal',
  Tab = 'tab',
  Welcome = 'Welcome',
}
export enum HomeRoutes {
  // InitialTab = 'overview',
  InitialTab = 'home',
  Dev = 'dev',
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
