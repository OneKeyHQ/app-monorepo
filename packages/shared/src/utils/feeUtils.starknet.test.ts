import BigNumber from 'bignumber.js';

import {
  calculateStarknetMinFee,
  calculateStarknetTotalFee,
  calculateTotalFeeRange,
} from './feeUtils';

import type { IFeeInfoUnit } from '../../types/fee';

/*
yarn jest packages/shared/src/utils/feeUtils.starknet.test.ts
*/

const starknetCommon: IFeeInfoUnit['common'] = {
  feeDecimals: 18,
  feeSymbol: 'STRK',
  nativeDecimals: 18,
  nativeSymbol: 'STRK',
};

// l1Gas: 100 * 1e9 = 1e11
// l2Gas: 2000 * 5e8 = 1e12
// l1DataGas: 50 * 2e9 = 1e11
// total = 1.2e12 FRI
const feeStarknetNoDeploy: IFeeInfoUnit['feeStarknet'] = {
  l1Gas: { maxAmount: '100', maxPricePerUnit: '1000000000' },
  l2Gas: { maxAmount: '2000', maxPricePerUnit: '500000000' },
  l1DataGas: { maxAmount: '50', maxPricePerUnit: '2000000000' },
};

// same resource bounds plus a 5e15 FRI deploy-account fee
const feeStarknetWithDeploy: IFeeInfoUnit['feeStarknet'] = {
  ...feeStarknetNoDeploy,
  deployAccountFee: '5000000000000000',
};

// same resource bounds plus a 9e11 FRI node overall_fee estimate (below the
// worst-case bound sum of 1.2e12 FRI)
const feeStarknetWithOverallFee: IFeeInfoUnit['feeStarknet'] = {
  ...feeStarknetNoDeploy,
  overallFee: '900000000000',
};

const feeStarknetWithOverallFeeAndDeploy: IFeeInfoUnit['feeStarknet'] = {
  ...feeStarknetNoDeploy,
  overallFee: '900000000000',
  deployAccountFee: '5000000000000000',
};

describe('calculateStarknetTotalFee', () => {
  it('sums the three resource bounds and shifts by feeDecimals when no deploy is attached', () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
      feeStarknet: feeStarknetNoDeploy,
    };
    expect(calculateStarknetTotalFee({ feeInfo }).toFixed()).toBe('0.0000012');
  });

  it('adds deployAccountFee on top of the resource bounds', () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
      feeStarknet: feeStarknetWithDeploy,
    };
    expect(calculateStarknetTotalFee({ feeInfo }).toFixed()).toBe('0.0050012');
  });

  it('treats a missing feeStarknet as zero', () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
    };
    expect(calculateStarknetTotalFee({ feeInfo }).toFixed()).toBe('0');
  });

  it('ignores overallFee (max always uses the resource-bounds sum)', () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
      feeStarknet: feeStarknetWithOverallFee,
    };
    expect(calculateStarknetTotalFee({ feeInfo }).toFixed()).toBe('0.0000012');
  });
});

describe('calculateStarknetMinFee', () => {
  it('falls back to the resource-bounds sum when overallFee is absent', () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
      feeStarknet: feeStarknetNoDeploy,
    };
    expect(calculateStarknetMinFee({ feeInfo }).toFixed()).toBe('0.0000012');
  });

  it('uses overallFee instead of the resource-bounds sum when present', () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
      feeStarknet: feeStarknetWithOverallFee,
    };
    expect(calculateStarknetMinFee({ feeInfo }).toFixed()).toBe('0.0000009');
  });

  it('adds deployAccountFee on top of overallFee', () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
      feeStarknet: feeStarknetWithOverallFeeAndDeploy,
    };
    expect(calculateStarknetMinFee({ feeInfo }).toFixed()).toBe('0.0050009');
  });

  it("prefers the deploy leg's estimate over its bound for display, keeping the bound for the max", () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
      feeStarknet: {
        ...feeStarknetWithOverallFeeAndDeploy,
        deployAccountOverallFee: '2000000000000000',
      },
    };
    expect(calculateStarknetMinFee({ feeInfo }).toFixed()).toBe('0.0020009');
    expect(calculateStarknetTotalFee({ feeInfo }).toFixed()).toBe('0.0050012');
  });

  it('adds deployAccountFee on top of the resource-bounds sum when overallFee is absent', () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
      feeStarknet: feeStarknetWithDeploy,
    };
    expect(calculateStarknetMinFee({ feeInfo }).toFixed()).toBe('0.0050012');
  });
});

describe('calculateTotalFeeRange (feeStarknet branch)', () => {
  it('returns the same value for min/max when overallFee is absent', () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
      feeStarknet: feeStarknetNoDeploy,
    };
    const result = calculateTotalFeeRange({ feeInfo });
    expect(typeof result.min).toBe('string');
    expect(typeof result.max).toBe('string');
    expect(result.min).toBe('0.0000012');
    expect(result.max).toBe('0.0000012');
    expect(result.minForDisplay).toBe('0.0000012');
    expect(result.maxForDisplay).toBe('0.0000012');
  });

  it('folds deployAccountFee into the headline total on both bounds', () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
      feeStarknet: feeStarknetWithDeploy,
    };
    const result = calculateTotalFeeRange({ feeInfo });
    expect(new BigNumber(result.min).toFixed()).toBe('0.0050012');
    expect(new BigNumber(result.max).toFixed()).toBe('0.0050012');
  });

  it('uses overallFee for min while max stays the resource-bounds sum', () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
      feeStarknet: feeStarknetWithOverallFee,
    };
    const result = calculateTotalFeeRange({ feeInfo });
    expect(new BigNumber(result.min).toFixed()).toBe('0.0000009');
    expect(new BigNumber(result.minForDisplay).toFixed()).toBe('0.0000009');
    expect(new BigNumber(result.max).toFixed()).toBe('0.0000012');
    expect(new BigNumber(result.maxForDisplay).toFixed()).toBe('0.0000012');
  });

  it('combines overallFee and deployAccountFee independently on each bound', () => {
    const feeInfo: IFeeInfoUnit = {
      common: starknetCommon,
      feeStarknet: feeStarknetWithOverallFeeAndDeploy,
    };
    const result = calculateTotalFeeRange({ feeInfo });
    expect(new BigNumber(result.min).toFixed()).toBe('0.0050009');
    expect(new BigNumber(result.max).toFixed()).toBe('0.0050012');
  });
});
