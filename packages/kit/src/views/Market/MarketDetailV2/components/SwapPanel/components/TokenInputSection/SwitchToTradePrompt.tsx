import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function SwitchToTradePrompt() {
  const intl = useIntl();
  return (
    <YStack
      borderBottomLeftRadius="$3"
      borderBottomRightRadius="$3"
      backgroundColor="$bgSubdued"
      px="$5"
      py="$2"
      alignItems="center"
    >
      <SizableText size="$bodyMd" color="$textSubdued">
        If you wish to trade other tokens, switch to{' '}
        <SizableText fontWeight="bold">
          {intl.formatMessage({ id: ETranslations.global_trade })}
        </SizableText>
      </SizableText>
    </YStack>
  );
}
