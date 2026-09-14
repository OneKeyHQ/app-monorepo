import type { IBorrowEModeSwitchCheck } from '@onekeyhq/shared/types/staking';

import { buildNeedActionItems } from '../BorrowEModeSwitch/emodeUtils';

import { isEModeBlockerDataUnavailable } from './needActionContract';

const BASE_ONLY_FIAT_SHORTFALL_CHECK = {
  canSwitch: false,
  reasons: [],
  additionalRepayFiatValue: '$12.34',
  collateral: {},
  debt: {},
  maxLtv: {},
  healthFactor: {},
} satisfies IBorrowEModeSwitchCheck;

describe('E-Mode need-action contract', () => {
  it.each([
    {
      name: 'empty blocker buckets',
      check: {
        ...BASE_ONLY_FIAT_SHORTFALL_CHECK,
        disableCollateralAssets: [],
        repayAssets: [],
        additionalRepayAssets: [],
      },
    },
    {
      name: 'missing blocker buckets',
      check: BASE_ONLY_FIAT_SHORTFALL_CHECK,
    },
  ])('fails closed for an only-fiat shortfall with $name', ({ check }) => {
    expect(buildNeedActionItems(check)).toEqual([]);
    expect(isEModeBlockerDataUnavailable(check)).toBe(true);
  });

  it('keeps a structured repay blocker executable when it has a raw amount', () => {
    const check = {
      ...BASE_ONLY_FIAT_SHORTFALL_CHECK,
      repayAssets: [
        {
          reserveAddress: '0xReserve',
          token: {
            address: '0xToken',
            decimals: 6,
            isNative: false,
            name: 'USD Coin',
            symbol: 'USDC',
          },
          borrowed: {
            title: { text: '12.34 USDC' },
            number: '12.34',
          },
        },
      ],
    } satisfies IBorrowEModeSwitchCheck;

    expect(isEModeBlockerDataUnavailable(check)).toBe(false);
  });
});
