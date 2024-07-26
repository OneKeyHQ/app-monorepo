export enum ESpotlightTour {
  createAllNetworks = 'createAllNetworks',
}

export type ITourTripTimes = number;

export interface ISpotlightData {
  data: Record<ESpotlightTour, ITourTripTimes>;
}
