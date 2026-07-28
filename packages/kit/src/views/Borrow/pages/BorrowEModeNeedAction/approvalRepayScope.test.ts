import type {
  IBorrowEModeBlockerAsset,
  IBorrowEModeSwitchCheck,
} from '@onekeyhq/shared/types/staking';

import {
  createApprovalRepayContext,
  resolveApprovedRepayStep,
  resolveRepayApprovalScope,
} from './approvalRepayScope';
import { blockerSteps as buildBlockerSteps } from './needActionSteps';

const EVM_NETWORK_ID = 'evm--1';

const blockerSteps = (items: Parameters<typeof buildBlockerSteps>[0]) =>
  buildBlockerSteps(items, EVM_NETWORK_ID);

function createAsset({
  reserveAddress = '0xReserve',
  tokenAddress = '0xToken',
  amount = '5',
}: {
  reserveAddress?: string;
  tokenAddress?: string;
  amount?: string;
} = {}): IBorrowEModeBlockerAsset {
  return {
    reserveAddress,
    token: {
      address: tokenAddress,
      decimals: 18,
      isNative: false,
      name: 'Token',
      symbol: 'TOKEN',
    },
    borrowed: {
      title: { text: amount },
      number: amount,
    },
  };
}

function createCheck({
  repayAssets = [],
  additionalRepayAssets = [],
}: {
  repayAssets?: IBorrowEModeBlockerAsset[];
  additionalRepayAssets?: IBorrowEModeBlockerAsset[];
}): IBorrowEModeSwitchCheck {
  return {
    canSwitch: false,
    reasons: [],
    disableCollateralAssets: [],
    repayAssets,
    additionalRepayAssets,
    collateral: {},
    debt: {},
    maxLtv: {},
    healthFactor: {},
  };
}

function createRepayStep(check: IBorrowEModeSwitchCheck) {
  const asset = check.repayAssets[0] ?? check.additionalRepayAssets[0];
  return blockerSteps([
    {
      kind: 'repay',
      reserveAddress: asset.reserveAddress,
      symbol: asset.token.symbol,
      amountValue: asset.borrowed?.number,
      hfSafety: check.additionalRepayAssets.includes(asset),
    },
  ])[0];
}

describe('approval repay scope', () => {
  it('keeps the launched step and token while a recheck clears live data', () => {
    const initialCheck = createCheck({ repayAssets: [createAsset()] });
    const launched = createApprovalRepayContext({
      step: createRepayStep(initialCheck),
      check: initialCheck,
    });
    const unrelatedStep = blockerSteps([
      {
        kind: 'repay',
        reserveAddress: '0xOtherReserve',
        symbol: 'OTHER',
        amountValue: '1',
      },
    ])[0];

    const scope = resolveRepayApprovalScope({
      launched,
      activeStep: unrelatedStep,
      check: null,
    });

    expect(scope).toBe(launched);
    expect(scope?.step.key).toBe('repay:0xreserve');
    expect(scope?.asset.token.address).toBe('0xToken');
    expect(scope?.step.amountValue).toBe('5');
  });

  it('continues with the latest amount only when the launched blocker remains', () => {
    const initialCheck = createCheck({ repayAssets: [createAsset()] });
    const launched = createApprovalRepayContext({
      step: createRepayStep(initialCheck),
      check: initialCheck,
    });
    const latestCheck = createCheck({
      repayAssets: [createAsset({ amount: '3' })],
    });

    expect(launched).not.toBeNull();
    expect(
      resolveApprovedRepayStep({
        launched: launched!,
        latestCheck,
        networkId: EVM_NETWORK_ID,
      })?.amountValue,
    ).toBe('3');
  });

  it('matches the launched reserve across checksum casing changes', () => {
    const initialCheck = createCheck({
      repayAssets: [createAsset({ reserveAddress: '0xAbCd' })],
    });
    const launched = createApprovalRepayContext({
      step: createRepayStep(initialCheck),
      check: initialCheck,
    });
    const latestCheck = createCheck({
      repayAssets: [createAsset({ reserveAddress: '0xaBcD', amount: '2' })],
    });

    expect(launched).not.toBeNull();
    expect(
      resolveApprovedRepayStep({
        launched: launched!,
        latestCheck,
        networkId: EVM_NETWORK_ID,
      })?.amountValue,
    ).toBe('2');
  });

  it('does not continue after the launched blocker is cleared', () => {
    const initialCheck = createCheck({ repayAssets: [createAsset()] });
    const launched = createApprovalRepayContext({
      step: createRepayStep(initialCheck),
      check: initialCheck,
    });

    expect(launched).not.toBeNull();
    expect(
      resolveApprovedRepayStep({
        launched: launched!,
        latestCheck: createCheck({}),
        networkId: EVM_NETWORK_ID,
      }),
    ).toBeUndefined();
  });

  it('fails closed when the same reserve returns a different token scope', () => {
    const initialCheck = createCheck({ repayAssets: [createAsset()] });
    const launched = createApprovalRepayContext({
      step: createRepayStep(initialCheck),
      check: initialCheck,
    });
    const latestCheck = createCheck({
      repayAssets: [createAsset({ tokenAddress: '0xDifferentToken' })],
    });

    expect(launched).not.toBeNull();
    expect(
      resolveApprovedRepayStep({
        launched: launched!,
        latestCheck,
        networkId: EVM_NETWORK_ID,
      }),
    ).toBeUndefined();
  });

  it('fails closed when an exact-approved partial repayment grows', () => {
    const initialCheck = createCheck({
      additionalRepayAssets: [createAsset({ amount: '2' })],
    });
    const launched = createApprovalRepayContext({
      step: createRepayStep(initialCheck),
      check: initialCheck,
    });
    const latestCheck = createCheck({
      additionalRepayAssets: [createAsset({ amount: '3' })],
    });

    expect(launched).not.toBeNull();
    expect(
      resolveApprovedRepayStep({
        launched: launched!,
        latestCheck,
        networkId: EVM_NETWORK_ID,
      }),
    ).toBeUndefined();
  });

  it('fails closed when repay-all semantics change after approval', () => {
    const initialCheck = createCheck({
      additionalRepayAssets: [createAsset({ amount: '2' })],
    });
    const launched = createApprovalRepayContext({
      step: createRepayStep(initialCheck),
      check: initialCheck,
    });
    const latestCheck = createCheck({
      repayAssets: [createAsset({ amount: '2' })],
    });

    expect(launched).not.toBeNull();
    expect(
      resolveApprovedRepayStep({
        launched: launched!,
        latestCheck,
        networkId: EVM_NETWORK_ID,
      }),
    ).toBeUndefined();
  });
});
