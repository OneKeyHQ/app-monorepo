export enum EModalBinanceDepositRoutes {
  BinanceDepositHome = 'BinanceDepositHome',
}

export type IModalBinanceDepositParamList = {
  // No params on purpose: navigation state must never carry a session key, a
  // return nonce or a Binance link. The page reads everything from bg.
  [EModalBinanceDepositRoutes.BinanceDepositHome]: undefined;
};
