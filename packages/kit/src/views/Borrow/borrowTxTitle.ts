import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';

import { parseBorrowTag } from '../Staking/utils/utils';

import type { IntlShape } from 'react-intl';

export function getBorrowTxTitle({
  intl,
  stakingInfo,
}: {
  intl: IntlShape;
  stakingInfo: IStakingInfo | undefined;
}) {
  const borrowAction = stakingInfo?.tags
    ?.map((tag) => parseBorrowTag(tag)?.action)
    .find((action) => action !== undefined);

  switch (borrowAction) {
    case 'supply':
      return intl.formatMessage({ id: ETranslations.defi_supply });
    case 'borrow':
      return intl.formatMessage({ id: ETranslations.global_borrow });
    case 'repay':
      return intl.formatMessage({ id: ETranslations.defi_repay });
    case 'withdraw':
      return intl.formatMessage({ id: ETranslations.global_withdraw });
    case 'claim':
      return intl.formatMessage({ id: ETranslations.earn_claim });
    case 'setEMode':
      return intl.formatMessage({ id: ETranslations.defi_emode_title });
    case 'setCollateral':
      return intl.formatMessage({ id: ETranslations.defi_collateral });
    default:
      break;
  }

  switch (stakingInfo?.label) {
    case EEarnLabels.Supply:
      return intl.formatMessage({ id: ETranslations.defi_supply });
    case EEarnLabels.Borrow:
      return intl.formatMessage({ id: ETranslations.global_borrow });
    case EEarnLabels.Repay:
      return intl.formatMessage({ id: ETranslations.defi_repay });
    case EEarnLabels.Withdraw:
      return intl.formatMessage({ id: ETranslations.global_withdraw });
    case EEarnLabels.Claim:
      return intl.formatMessage({ id: ETranslations.earn_claim });
    default:
      return undefined;
  }
}
