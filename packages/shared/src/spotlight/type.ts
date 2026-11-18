export enum ESpotlightTour {
  createAllNetworks = 'createAllNetworks',
  allNetworkAccountValue = 'allNetworkAccountValue',
  switchDappAccount = 'switchDappAccount',
  showFloatingIconDialog = 'showFloatingIconDialog',
  referAFriend = 'referAFriend',
  earnRewardAlert = 'earnRewardAlert',
  allNetworksInfo = 'allNetworksInfo',
  earnRewardHistory = 'earnRewardHistory',
  showDevelopmentBuildWarningDialog = 'showDevelopmentBuildWarningDialog',
  splitViewFirstPrompt = 'splitViewFirstPrompt',
  perpLayoutSettingsMenu = 'perpLayoutSettingsMenu',
  perpLayoutSettings = 'perpLayoutSettings',
  perpDesktopChartResize = 'perpDesktopChartResize',
  portfolioMoreMenu = 'portfolioMoreMenu',
  homeDustSweepBanner = 'homeDustSweepBanner',
}

export type ITourTripTimes = number;

export interface ISpotlightData {
  data: Record<ESpotlightTour, ITourTripTimes>;
}
