import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { HeightTransition, Image } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { SendTestIDs } from '@onekeyhq/kit/src/views/Send/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  BINANCE_LOGO,
  BINANCE_LOGO_RING,
  CARD_FRAME,
} from './binanceDepositVisuals';

// Fades in when offered and pushes everything below down instead of
// jumping; collapses the same way while an address is being typed. Its gap
// to the input sits inside the transition, so it collapses too.
export function BinanceDepositEntry({
  hidden,
  onPress,
  onShown,
}: {
  hidden: boolean;
  onPress: () => void;
  // Called while the entry is on screen, for the impression.
  onShown: () => void;
}) {
  const intl = useIntl();
  useEffect(() => {
    if (!hidden) {
      onShown();
    }
  }, [hidden, onShown]);
  return (
    <HeightTransition hide={hidden}>
      <ListItem
        testID={SendTestIDs.binanceDepositEntry}
        mx="$0"
        mt="$3"
        // The large address input's inner padding, so the logo lines up
        // with the input's text.
        px="$3.5"
        py="$3"
        gap="$3"
        drillIn
        onPress={onPress}
        borderWidth={CARD_FRAME.borderWidth}
        borderColor={CARD_FRAME.borderColor}
        borderRadius={CARD_FRAME.borderRadius}
        borderCurve={CARD_FRAME.borderCurve}
        userSelect="none"
      >
        <Image
          w="$6"
          h="$6"
          borderRadius="$full"
          {...BINANCE_LOGO_RING}
          source={BINANCE_LOGO}
        />
        <ListItem.Text
          flex={1}
          primary={intl.formatMessage({
            id: ETranslations.binance_deposit_account__title,
          })}
          primaryTextProps={{ size: '$bodyLg' }}
        />
      </ListItem>
    </HeightTransition>
  );
}
