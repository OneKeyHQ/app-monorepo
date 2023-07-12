export enum SendModalRoutes {
  PreSendToken = 'PreSendToken',
  PreSendAddress = 'PreSendAddress',
  PreSendAmount = 'PreSendAmount',
  SendConfirm = 'SendConfirm',
  SendConfirmFromDapp = 'SendConfirmFromDapp',
  SendEditFee = 'SendEditFee',
  TokenApproveAmountEdit = 'TokenApproveAmountEdit',
  SendSpecialWarning = 'SendSpecialWarning',
  SendAuthentication = 'SendAuthentication',
  SignMessageConfirm = 'SignMessageConfirm',
  SendFeedbackReceipt = 'SendFeedbackReceipt',
  HardwareSwapContinue = 'HardwareSwapContinue',
  BatchSendConfirm = 'BatchSendConfirm',
  BatchSendManyToNConfirm = 'BatchSendManyToNConfirm',
  BatchSendProgress = 'BatchSendProgress',
  NFTDetailModal = 'NFTDetailModal',
  LNURLPayRequest = 'LNURLPayRequest',
  LNURLWithdraw = 'LNURLWithdraw',
  LNURLAuth = 'LNURLAuth',
  LNURLAuthentication = 'LNURLAuthentication',
}

export enum ESendEditFeeTypes {
  standard = 'standard',
  advanced = 'advanced',
}

export enum BatchSendState {
  idle = 'idle',
  inProgress = 'inProgress',
  onPause = 'onPause',
}
