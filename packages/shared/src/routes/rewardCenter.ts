export enum EModalRewardCenterRoutes {
  RewardCenter = 'RewardCenter',
}

export type IModalRewardCenterParamList = {
  [EModalRewardCenterRoutes.RewardCenter]: {
    accountId: string;
    networkId: string;
    showAccountSelector?: boolean;
    onClose?: ({
      isResourceClaimed,
      isResourceRedeemed,
    }: {
      isResourceClaimed: boolean;
      isResourceRedeemed: boolean;
    }) => void;
  };
};
