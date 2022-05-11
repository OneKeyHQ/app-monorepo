/** Modal */
export enum ModalRoutes {
  CreateAccount = 'CreateAccount',
  ImportAccount = 'ImportAccount',
  WatchedAccount = 'WatchAccount',
  CreateWallet = 'CreateWallet',
  BackupWallet = 'BackupWallet',
  ManagerWallet = 'ManagerWallet',
  ManagerAccount = 'ManagerAccount',
  WalletViewMnemonics = 'WalletViewMnemonics',
  Send = 'Send',
  Receive = 'Receive',
  SubmitRequest = 'SubmitRequest',
  HistoryRequest = 'HistoryRequest',
  TransactionDetail = 'TransactionDetail',
  OnekeyLiteReset = 'OnekeyLiteReset',
  OnekeyLiteChangePinInputPin = 'OnekeyLiteChangePinInputPin',
  DappApproveModal = 'DappApproveModal',
  DappMulticallModal = 'DappMulticallModal',
  DappConnectionModal = 'DappConnectionModal',
  Password = 'Password',
  ManageToken = 'ManageToken',
  Collectibles = 'Collectibles',
  EnableLocalAuthentication = ' EnableLocalAuthentication',
  ManageNetwork = 'ManageNetwork',
  OnekeyHardware = 'OnekeyHardware',
  Discover = 'Discover',
  Swap = 'Swap',
  UpdateFeature = 'UpdateFeature',
}
export enum DappModalRoutes {
  ConnectionModal = 'ConnectionModal',
  ApproveModal = 'ApproveModal',
  MulticallModal = 'MulticallModal',
  SendConfirmModal = 'SendConfirmModal',
}
export enum RootRoutes {
  Root = 'root',
  Modal = 'modal',
  Tab = 'tab',
}
