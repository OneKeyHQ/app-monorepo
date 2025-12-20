import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

export interface IPerpDepositInitiateParams {
  userAddress: string;
  receiverAddress: string;
  txId?: string;
  token: IPerpsDepositToken;
  amount: string;
  toAmount: string;
  status: ESwapTxHistoryStatus;
  errorMessage?: string;
}

export interface IPerpUserSelectDepositTokenParams {
  userAddress: string;
  depositToken: IPerpsDepositToken;
}
