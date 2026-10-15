import type {
  ETestModalPages,
  ITestModalPagesParam,
} from '@onekeyhq/shared/src/routes';

export type IEnergyPackageDemo = {
  isPrime: boolean;
  giftUnits: number;
  purchases: { units: number; expiresAt: number }[];
};

// Illustrative offers only; no payment, identity, or entitlement services are used.
export const energyPackageOffers = [
  { units: 10, price: '$3.99' },
  { units: 30, price: '$9.99' },
];
export const purchaseLifetime = 30 * 24 * 60 * 60 * 1000;

export function createEnergyPackageDemo(
  scenario: ITestModalPagesParam[ETestModalPages.NetworkFeeSubsidy]['energyPackageScenario'] = 'available',
): IEnergyPackageDemo {
  return {
    isPrime:
      scenario === 'available' ||
      scenario === 'mixed' ||
      scenario === 'exhausted',
    giftUnits: scenario === 'available' || scenario === 'mixed' ? 24 : 0,
    purchases:
      scenario === 'purchased' || scenario === 'mixed'
        ? [{ units: 20, expiresAt: Date.now() + purchaseLifetime }]
        : [],
  };
}

export function getPurchasedUnits(state: IEnergyPackageDemo) {
  return state.purchases.reduce((total, purchase) => total + purchase.units, 0);
}
