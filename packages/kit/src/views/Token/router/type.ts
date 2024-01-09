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
  [ETokenPages.TokenDetails]: {
    accountId: string;
    networkId: string;
    tokenAddress: string;
    isNative?: boolean;
  };
  [ETokenPages.TokenList]: {
    title?: string;
    helpText?: string;
    onPressToken?: () => void;
    accountId: string;
    networkId: string;
    tokenList: {
      tokens: IAccountToken[];
      keys: string;
      tokenMap: Record<string, ITokenFiat>;
    };
  };
  [ETokenPages.NFTDetails]: {
    networkId: string;
    accountAddress: string;
    collectionAddress: string;
    itemId: string;
  };
  [ETokenPages.Receive]: undefined;
  [ETokenPages.History]: { status?: string };
  [ETokenPages.Send]: { tokenUrl?: string; isNFT?: boolean };
};
