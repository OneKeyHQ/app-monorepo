import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useAccountSelectorTrigger } from '../../../AccountSelector/hooks/useAccountSelectorTrigger';

export function WebConnectButton() {
  const intl = useIntl();
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    showConnectWalletModalInDappMode: true,
  });

  return (
    <XStack
      h="$8"
      ai="center"
      jc="center"
      bg="$brand9"
      borderRadius="$full"
      px="$3"
      cursor="pointer"
      hoverStyle={{ opacity: 0.9 }}
      pressStyle={{ opacity: 0.8 }}
      onPress={showAccountSelector}
      role="button"
      testID="web-connect-button"
    >
      <SizableText size="$bodyLgMedium" color="#000000">
        {intl.formatMessage({ id: ETranslations.global_connect })}
      </SizableText>
    </XStack>
  );
}
