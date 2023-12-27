export enum ETokenPages {
  TokenDetails = 'TokenDetails',
  LowValueTokens = 'LowValueTokens',
}

export type ITokenParamList = {
  [ETokenPages.TokenDetails]: undefined;
  [ETokenPages.LowValueTokens]: undefined;
};
