export enum ESpotlightTour {
  createAllNetworks = 'createAllNetworks',
  oneKeyProBanner = 'oneKeyProBanner',
  allNetworkAccountValue = 'allNetworkAccountValue',
  switchDappAccount = 'switchDappAccount',
  showFloatingIconDialog = 'showFloatingIconDialog',
  referAFriend = 'referAFriend',
  hardwareSalesRewardAlert = 'hardwareSalesRewardAlert',
  earnRewardAlert = 'earnRewardAlert',
}

export type ITourTripTimes = number;

export interface ISpotlightData {
  data: Record<ESpotlightTour, ITourTripTimes>;
}
