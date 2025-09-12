import type { IBadgeType, IKeyOfIcons } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';

import type { ENFTType, IAccountNFT } from './nft';
import type { ISwapTxInfo } from './swap/types';
import type { IToken, ITokenFiat } from './token';
import type { ISendTxOnSuccessData } from './tx';

export enum EParseTxComponentType {
  Default = 'default',
  Network = 'network',
  Address = 'address',
  NFT = 'nft',
  Amount = 'amount',
  Token = 'token',
  Assets = 'assets',
  Approve = 'tokenApproval',
  Divider = 'divider',
  InternalAssets = 'internalAssets',
  DateTime = 'datetime',
}

export enum EParseTxComponentRole {
  SwapReceiver = 'swapReceiver',
}

export enum EParseTxType {
  Unknown = 'unknown',
  Approve = 'approveToken',
}

export enum EParseMessageType {
  Permit = 'permit',
}

export enum EParseTxDateTimeFormat {
  Duration = 'duration',
}

export enum ETransferDirection {
  In = 'in',
  Out = 'out',
}

export interface IDisplayComponentDateTime {
  type: EParseTxComponentType.DateTime;
  label: string;
  value: number;
  format: string;
}

export interface IDisplayComponentDivider {
  type: EParseTxComponentType.Divider;
}

export interface IDisplayComponentNetwork {
  type: EParseTxComponentType.Network;
  label: string;
  networkId: string;
}

export interface IDisplayComponentAddress {
  type: EParseTxComponentType.Address;
  role?: EParseTxComponentRole;
  label: string;
  address: string;
  tags: {
    value: string;
    displayType: IBadgeType;
    icon?: IKeyOfIcons;
    iconURL?: string;
  }[];
  isNavigable?: boolean;
  networkId?: string;
  showAccountName?: boolean;
}

export interface IDisplayComponentAmount {
  type: EParseTxComponentType.Amount;
  label: string;
  amount: string;
}

export interface IDisplayComponentNFT {
  type: EParseTxComponentType.NFT;
  label: string;
  nft: IAccountNFT;
  amount: string;
  transferDirection?: ETransferDirection;
}

export interface IDisplayComponentToken {
  type: EParseTxComponentType.Token;
  label: string;
  token: {
    info: IToken;
  } & ITokenFiat;
  amount: string;
  amountParsed: string;
  networkId: string;
  showNetwork: boolean;
  transferDirection?: ETransferDirection;
}

export interface IDisplayComponentAssets {
  type: EParseTxComponentType.Assets;
  label: string;
  assets: (
    | IDisplayComponentInternalAssets
    | IDisplayComponentNFT
    | IDisplayComponentToken
  )[];
}

export interface IDisplayComponentInternalAssets {
  type: EParseTxComponentType.InternalAssets;
  label: string;
  name: string;
  icon: string;
  symbol: string;
  amount: string;
  amountParsed: string;
  networkId?: string;
  isNFT?: boolean;
  transferDirection?: ETransferDirection;
  NFTType?: ENFTType;
}

export interface IDisplayComponentApprove {
  type: EParseTxComponentType.Approve;
  label: string;
  token: {
    info: IToken;
  } & ITokenFiat;
  amount?: string;
  amountParsed: string;
  balance?: string;
  balanceParsed?: string;
  isEditable: boolean;
  isInfiniteAmount: boolean;
  networkId: string;
  showNetwork: boolean;
}

export interface IDisplayComponentDefault {
  type: EParseTxComponentType.Default;
  label: string;
  value: string;
}

export type IDisplayComponent =
  | IDisplayComponentDivider
  | IDisplayComponentAssets
  | IDisplayComponentInternalAssets
  | IDisplayComponentToken
  | IDisplayComponentApprove
  | IDisplayComponentNFT
  | IDisplayComponentNetwork
  | IDisplayComponentAddress
  | IDisplayComponentDateTime
  | IDisplayComponentDefault;

export interface ITransactionData {
  name: string;
  args: string[];
  textSignature: string;
  hexSignature: string;
}

export interface ISignatureConfirmDisplay {
  title: string;
  components: IDisplayComponent[];
  alerts: string[];
  mevProtectionProvider?: {
    name: string;
    logoURI: string;
    logoURIDark?: string;
  };
}

export interface IParseTransactionParams {
  networkId: string;
  accountId: string;
  encodedTx: IEncodedTx;
  accountAddress?: string;
}

export interface IParseTransactionResp {
  accountAddress: string;
  parsedTx: {
    to: {
      address: string;
      name: null | string;
      labels: null | string[];
      isContract: boolean;
      riskLevel: number;
    };
    data: ITransactionData;
  };
  display: ISignatureConfirmDisplay | null;
  type: EParseTxType;
  isConfirmationRequired?: boolean;
}

export interface IParseMessageParams {
  accountId: string;
  networkId: string;
  accountAddress?: string;
  message: string;
  swapInfo?: ISwapTxInfo;
}

export interface IParseMessageResp {
  accountAddress: string;
  display: ISignatureConfirmDisplay;
  type: EParseTxType;
  isConfirmationRequired?: boolean;
}

export interface IAfterSendTxActionParams {
  result: ISendTxOnSuccessData[];
}
