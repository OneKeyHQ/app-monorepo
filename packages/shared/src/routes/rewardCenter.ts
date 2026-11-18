export enum EModalRewardCenterRoutes {
  RewardCenter = 'RewardCenter',
  SubsidyHistory = 'SubsidyHistory',
}

export type IRewardCenterCloseResult = {
  isResourceClaimed: boolean;
  isResourceRedeemed: boolean;
};

export type IModalRewardCenterParamList = {
  // The route name and the /reward-center path predate the subsidy center and
  // are kept for the TRON energy entries (wallet "More", transaction
  // confirmation, QR code). It now opens the subsidy center; an entry that
  // passes an account lands on the TRON energy claim for that account.
  [EModalRewardCenterRoutes.RewardCenter]:
    | {
        accountId?: string;
        networkId?: string;
        walletId?: string;
        showAccountSelector?: boolean;
        onClose?: (result: IRewardCenterCloseResult) => void;
      }
    | undefined;
  [EModalRewardCenterRoutes.SubsidyHistory]: undefined;
};
