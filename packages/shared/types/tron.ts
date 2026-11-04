/* cspell:ignore tronweb */
// Raw `trx.getAccountResources` payload as tronweb returns it through the
// wallet proxy. Every field is absent for an account the chain has not seen.
export type ITronAccountResourcesRaw = {
  EnergyLimit?: number;
  EnergyUsed?: number;
  NetLimit?: number;
  NetUsed?: number;
  freeEnergyLimit?: number;
  freeEnergyUsed?: number;
  freeNetLimit?: number;
  freeNetUsed?: number;
};

// Energy / bandwidth figures as the UI shows them: decimal strings so the
// snapshot survives the JSON round-trip through the bridge and the SWR cache.
export type ITronAccountResources = {
  energyAvailable: string;
  energyTotal: string;
  netAvailable: string;
  netTotal: string;
};
