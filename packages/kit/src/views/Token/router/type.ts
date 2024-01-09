import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

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
    onPressToken?: () => void;
    tokenList: {
      tokens: IAccountToken[];
      keys: string;
      tokenMap: Record<string, ITokenFiat>;
    };
  };
  [ETokenPages.NFTDetails]: undefined;
  [ETokenPages.Receive]: undefined;
  [ETokenPages.History]: { status?: string };
  [ETokenPages.Send]: { tokenUrl?: string; isNFT?: boolean };
};
