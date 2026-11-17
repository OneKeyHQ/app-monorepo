import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEarnLabels, type IStakingInfo } from '@onekeyhq/shared/types/staking';

import { getBorrowTxTitle } from './borrowTxTitle';

import type { IntlShape } from 'react-intl';

const intl = {
  formatMessage: ({ id }: { id: ETranslations }) => id,
} as IntlShape;

function buildStakingInfo(
  label: EEarnLabels,
  actionTag?: string,
): IStakingInfo {
  return {
    label,
    protocol: 'Aave',
    tags: [EEarnLabels.Borrow, ...(actionTag ? [actionTag] : [])],
  };
}

describe('getBorrowTxTitle', () => {
  it.each([
    ['repay', ETranslations.defi_repay],
    ['setCollateral', ETranslations.defi_collateral],
    ['setEMode', ETranslations.defi_emode_title],
  ] as const)(
    'derives the %s title from the structured borrow action tag',
    (action, expectedTitle) => {
      expect(
        getBorrowTxTitle({
          intl,
          stakingInfo: buildStakingInfo(
            EEarnLabels.Borrow,
            `borrow:aave:${action}`,
          ),
        }),
      ).toBe(expectedTitle);
    },
  );

  it('falls back to the legacy label when no structured action tag exists', () => {
    expect(
      getBorrowTxTitle({
        intl,
        stakingInfo: buildStakingInfo(EEarnLabels.Repay),
      }),
    ).toBe(ETranslations.defi_repay);
  });
});
