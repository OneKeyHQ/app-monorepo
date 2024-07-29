export enum ESpotlightTour {
  createAllNetworks = 'createAllNetworks',
  oneKeyProBanner = 'oneKeyProBanner',
}

export type ITourTripTimes = number;

export interface ISpotlightData {
  data: Record<ESpotlightTour, ITourTripTimes>;
}
