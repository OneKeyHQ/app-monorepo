import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useHoldersLayoutSmall } from './useHoldersLayoutSmall';

const commonTextProps = { size: '$bodySm', color: '$textSubdued' } as const;

function HoldersHeaderSmallBase() {
  const intl = useIntl();
  const { styles } = useHoldersLayoutSmall();

  return (
    <XStack px="$4" py="$3" alignItems="center" gap="$3">
      <SizableText {...commonTextProps} {...styles.rank}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_holders_rank,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...styles.address}>
        {intl.formatMessage({
          id: ETranslations.global_address,
        })}
      </SizableText>
      <SizableText {...commonTextProps} {...styles.percentage}>
        %
      </SizableText>
      <SizableText {...commonTextProps} {...styles.value}>
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_value,
        })}
      </SizableText>
    </XStack>
  );
}

const HoldersHeaderSmall = memo(HoldersHeaderSmallBase);

export { HoldersHeaderSmall };
