export interface ISetTpslParams {
  coin: string;
  szDecimals: number;
  assetId: number;
  isMobile?: boolean;
}

export type IPerpsDepositWithdrawActionType =
  | 'deposit'
  | 'depositSelect'
  | 'withdraw'
  | 'walletDeposit'
  | 'relay';
