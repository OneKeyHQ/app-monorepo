export enum EModalReferFriendsRoutes {
  ReferAFriend = 'ReferAFriend',
  YourReferred = 'YourReferred',
  HardwareSalesReward = 'HardwareSalesReward',
  OneKeyId = 'OneKeyId',
  InviteReward = 'InviteReward',
  EditAddress = 'EditAddress',
  EarnReward = 'EarnReward',
}

export type IModalReferFriendsParamList = {
  [EModalReferFriendsRoutes.ReferAFriend]: {
    utmSource?: string;
  };
  [EModalReferFriendsRoutes.YourReferred]: undefined;
  [EModalReferFriendsRoutes.HardwareSalesReward]: undefined;
  [EModalReferFriendsRoutes.OneKeyId]: undefined;
  [EModalReferFriendsRoutes.InviteReward]: undefined;
  [EModalReferFriendsRoutes.EditAddress]: {
    enabledNetworks: string[];
    accountId: string;
    onAddressAdded: ({
      address,
      networkId,
    }: {
      address: string;
      networkId: string;
    }) => void;
  };
  [EModalReferFriendsRoutes.EarnReward]: undefined;
};
