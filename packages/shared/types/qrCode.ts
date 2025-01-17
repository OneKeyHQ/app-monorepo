export enum EQRCodeHandlerType {
  UNKNOWN = 'UNKNOWN',
  BITCOIN = 'BITCOIN',
  ETHEREUM = 'ETHEREUM',
  SOLANA = 'SOLANA',
  LIGHTNING_NETWORK = 'LIGHTNING_NETWORK',
  URL = 'URL',
  WALLET_CONNECT = 'WALLET_CONNECT',
  MIGRATE = 'MIGRATE',
  ANIMATION_CODE = 'ANIMATION_CODE',
  DEEPLINK = 'DEEPLINK',
  URL_ACCOUNT = 'URL_ACCOUNT',
  MARKET_DETAIL = 'MARKET_DETAIL',
  SEND_PROTECTION = 'SEND_PROTECTION',
}

export enum EQRCodeHandlerNames {
  bitcoin = 'bitcoin',
  ethereum = 'ethereum',
  solana = 'solana',
  walletconnect = 'walletconnect',
  migrate = 'migrate',
  animation = 'animation',
  urlAccount = 'urlAccount',
  marketDetail = 'marketDetail',
  sendProtection = 'sendProtection',
}

export const PARSE_HANDLER_NAMES = {
  all: [
    EQRCodeHandlerNames.bitcoin,
    EQRCodeHandlerNames.ethereum,
    EQRCodeHandlerNames.solana,
    EQRCodeHandlerNames.walletconnect,
    EQRCodeHandlerNames.migrate,
    EQRCodeHandlerNames.animation,
    EQRCodeHandlerNames.urlAccount,
    EQRCodeHandlerNames.marketDetail,
    EQRCodeHandlerNames.sendProtection,
  ],
  animation: [EQRCodeHandlerNames.animation],
  none: [],
} as Record<string, EQRCodeHandlerNames[]>;
