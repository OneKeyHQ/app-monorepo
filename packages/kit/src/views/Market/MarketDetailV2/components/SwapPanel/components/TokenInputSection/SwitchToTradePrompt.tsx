import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { useMarketTradeActions } from '@onekeyhq/kit/src/views/Market/components/tradeHook';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ISwitchToTradePromptProps {
  onTradePress: () => void;
}

export function SwitchToTradePrompt(props: ISwitchToTradePromptProps) {
  const { onTradePress } = props;
  const intl = useIntl();
  const { onSwap } = useMarketTradeActions(null);

  const handleTradePress = () => {
    void onSwap();
    onTradePress?.();
  };

  return (
    <YStack
      onPress={handleTradePress}
      borderBottomLeftRadius="$3"
      borderBottomRightRadius="$3"
      backgroundColor="$bgSubdued"
      px="$5"
      py="$2"
      alignItems="center"
      justifyContent="center"
    >
      <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
        {intl.formatMessage({ id: ETranslations.dexmarket_switch_to_trade })}
        <SizableText fontWeight="bold" cursor="pointer">
          {intl.formatMessage({ id: ETranslations.global_trade })}
        </SizableText>
      </SizableText>
    </YStack>
  );
}
