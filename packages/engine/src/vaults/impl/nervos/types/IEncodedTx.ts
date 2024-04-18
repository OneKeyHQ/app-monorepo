import type { IFeeInfoUnit, ITransferInfo } from '../../../types';
import type { Transaction } from '@ckb-lumos/base';

export type IEncodedTxNervos = {
  transferInfo: ITransferInfo;
  hasMaxSend?: boolean;
  feeInfo?: IFeeInfoUnit;
  tx: Transaction;
};
