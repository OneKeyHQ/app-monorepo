import type { IFeeInfoUnit, ITransferInfo } from '../../../types';
import type { Cell, CellDep } from '@ckb-lumos/base';

export type IEncodedTxNervos = {
  transferInfo: ITransferInfo;
  cellDeps: CellDep[];
  inputs: Cell[];
  outputs: {
    address: string;
    value: string;
    data?: string;
  }[];
  change?: {
    address: string;
    value: string;
    data?: string;
  };
  hasMaxSend?: boolean;
  feeInfo?: IFeeInfoUnit;
};
