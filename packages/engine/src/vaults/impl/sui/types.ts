import type { IFeeInfoUnit } from '../../types';
import type {
  ExecuteTransactionRequestType,
  SuiMoveObject,
} from '@mysten/sui.js';

export type IEncodedTxSUI = {
  rawTx: string;
  feeInfo?: IFeeInfoUnit;
  requestType?: ExecuteTransactionRequestType;
};

export type CoinObject = {
  objectId: string;
  symbol: string;
  balance: bigint;
  object: SuiMoveObject;
};

export type NftObject = {
  objectId: string;
  name: string;
  description: string;
  url: string;
  previousTransaction?: string;
  objectType: string;
  fields: Record<string, any>;
  hasPublicTransfer: boolean;
};
