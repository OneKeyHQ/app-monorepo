export enum ETokenPages {
  TokenDetails = 'TokenDetails',
  TokenList = 'TokenList',
  NFTDetails = 'NFTDetails',
  Receive = 'Receive',
  History = 'History',
  Send = 'Send',
}

export type ITokenParamList = {
  [ETokenPages.TokenDetails]: undefined;
  [ETokenPages.TokenList]: {
    title?: string;
    helpText?: string;
    onTokenPress?: () => void;
  };
  [ETokenPages.NFTDetails]: undefined;
  [ETokenPages.Receive]: undefined;
  [ETokenPages.History]: { status?: string };
  [ETokenPages.Send]: { tokenUrl?: string };
};
