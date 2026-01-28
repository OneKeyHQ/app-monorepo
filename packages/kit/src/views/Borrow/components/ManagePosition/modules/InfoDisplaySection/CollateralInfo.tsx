import { useIntl } from 'react-intl';

import { Icon } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { BorrowInfoItem } from '../../../BorrowInfoItem';

export function CollateralInfo() {
  const intl = useIntl();

  return (
    <BorrowInfoItem
      gap="$1"
      title={intl.formatMessage({
        id: ETranslations.defi_use_as_collateral,
      })}
    >
      <Icon name="Checkmark2SmallOutline" size="$5" color="$textSuccess" />
      <EarnText
        text={{
          text: intl.formatMessage({
            id: ETranslations.global_enabled,
          }),
          color: '$textSuccess',
          size: '$bodyMdMedium',
        }}
      />
    </BorrowInfoItem>
  );
}
