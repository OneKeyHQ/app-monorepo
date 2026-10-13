import BigNumber from 'bignumber.js';

import type {
  ITronAccountResources,
  ITronAccountResourcesRaw,
} from '../../types/tron';

function clampAvailable(value: BigNumber) {
  return value.isNegative() ? new BigNumber(0) : value;
}

// Total = paid quota + free quota; available = total minus both usages,
// floored at zero since the chain can report usage above the quota.
export function parseTronAccountResources(
  resources: ITronAccountResourcesRaw,
): ITronAccountResources {
  const netTotal = new BigNumber(resources.NetLimit ?? 0).plus(
    resources.freeNetLimit ?? 0,
  );
  const netAvailable = clampAvailable(
    netTotal.minus(resources.NetUsed ?? 0).minus(resources.freeNetUsed ?? 0),
  );
  const energyTotal = new BigNumber(resources.EnergyLimit ?? 0).plus(
    resources.freeEnergyLimit ?? 0,
  );
  const energyAvailable = clampAvailable(
    energyTotal
      .minus(resources.EnergyUsed ?? 0)
      .minus(resources.freeEnergyUsed ?? 0),
  );
  return {
    energyAvailable: energyAvailable.toFixed(),
    energyTotal: energyTotal.toFixed(),
    netAvailable: netAvailable.toFixed(),
    netTotal: netTotal.toFixed(),
  };
}
