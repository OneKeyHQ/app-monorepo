import { useIntl } from 'react-intl';

import { Empty, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function SwapEmptyData() {
  const intl = useIntl();

  return (
    <YStack ai="center">
      <Empty
        mt="$-10"
        illustration="ShakeHands"
        title={intl.formatMessage({
          id: ETranslations.referral_referred_empty,
        })}
        description={intl.formatMessage({
          id: ETranslations.referral_referred_empty_desc,
        })}
      />
    </YStack>
  );
}
