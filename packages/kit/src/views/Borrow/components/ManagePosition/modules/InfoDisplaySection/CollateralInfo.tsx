import { useIntl } from 'react-intl';

import { Icon } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BorrowInfoItem } from '../../../BorrowInfoItem';

export function CollateralInfo({
  canBeCollateral,
  usageAsCollateral,
}: {
  canBeCollateral: boolean;
  usageAsCollateral?: boolean;
}) {
  const intl = useIntl();
  const status = (() => {
    if (!canBeCollateral) {
      return {
        icon: 'CrossedSmallOutline' as const,
        iconColor: '$iconCritical' as const,
        text: intl.formatMessage({
          id: ETranslations.global_not_available,
        }),
        textColor: '$textCritical' as const,
      };
    }
    if (usageAsCollateral === true) {
      return {
        icon: 'Checkmark2SmallOutline' as const,
        iconColor: '$iconSuccess' as const,
        text: intl.formatMessage({
          id: ETranslations.global_enabled,
        }),
        textColor: '$textSuccess' as const,
      };
    }
    return {
      icon: 'CrossedSmallOutline' as const,
      iconColor: '$iconCaution' as const,
      text: intl.formatMessage({
        id: ETranslations.global_disabled,
      }),
      textColor: '$textCaution' as const,
    };
  })();

  return (
    <BorrowInfoItem
      testID="borrow-collateral-status"
      gap="$1"
      title={intl.formatMessage({
        id: ETranslations.defi_use_as_collateral,
      })}
    >
      <Icon name={status.icon} size="$5" color={status.iconColor} />
      <EarnText
        text={{
          text: status.text,
          color: status.textColor,
          size: '$bodyMdMedium',
        }}
      />
    </BorrowInfoItem>
  );
}
