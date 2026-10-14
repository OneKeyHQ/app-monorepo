import { parseTronAccountResources } from './tronResourceUtils';

/*
yarn jest packages/shared/src/utils/tronResourceUtils.test.ts
*/

describe('parseTronAccountResources', () => {
  it('sums paid and free quotas and subtracts both usages', () => {
    expect(
      parseTronAccountResources({
        EnergyLimit: 100,
        EnergyUsed: 30,
        freeEnergyLimit: 20,
        freeEnergyUsed: 5,
        NetLimit: 1000,
        NetUsed: 200,
        freeNetLimit: 600,
        freeNetUsed: 350,
      }),
    ).toEqual({
      energyAvailable: '85',
      energyTotal: '120',
      netAvailable: '1050',
      netTotal: '1600',
    });
  });

  it('treats missing fields as zero and never reports a negative balance', () => {
    expect(
      parseTronAccountResources({
        freeNetLimit: 600,
        freeNetUsed: 650,
      }),
    ).toEqual({
      energyAvailable: '0',
      energyTotal: '0',
      netAvailable: '0',
      netTotal: '600',
    });
  });
});
