import {
  Icon,
  SizableText,
  Stack,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { formatPortfolioTotal } from './formatPortfolioTotal';

const TABULAR_NUMS: ['tabular-nums'] = ['tabular-nums'];

export type IProtocolHeaderRowProps = {
  name: string;
  logo?: string;
  networkId: string;
  currencySymbol: string;
  netWorth: number | string;
  isAllNetworks?: boolean;
  positionCountText?: string;
  open?: boolean;
};

function ProtocolHeaderRow({
  name,
  logo,
  networkId,
  currencySymbol,
  netWorth,
  isAllNetworks,
  positionCountText,
  open = true,
}: IProtocolHeaderRowProps) {
  const [settingsValue] = useSettingsValuePersistAtom();
  const formattedNetWorth = formatPortfolioTotal(
    Number(netWorth) || 0,
    currencySymbol,
    settingsValue.hideValue,
  );

  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      px="$5"
      py="$3"
      bg="$bgSubdued"
      // Top corners follow the parent card's $3 radius; bottom is square
      // because the category groups continue directly below this row.
      borderTopLeftRadius="$3"
      borderTopRightRadius="$3"
      borderCurve="continuous"
    >
      <XStack gap="$3" alignItems="center" flex={1} minWidth={0}>
        <Token
          size="md"
          tokenImageUri={logo}
          showNetworkIcon={isAllNetworks}
          networkId={networkId}
        />
        <YStack flex={1} minWidth={0} alignItems="flex-start">
          <SizableText size="$headingLg" numberOfLines={1} color="$text">
            {name}
          </SizableText>
          {positionCountText ? (
            <SizableText
              size="$bodyMd"
              numberOfLines={1}
              color="$textSubdued"
              pointerEvents="none"
            >
              {positionCountText}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
      <SizableText
        size="$headingLg"
        numberOfLines={1}
        textAlign="right"
        minWidth={120}
        maxWidth={168}
        color="$text"
        fontVariant={TABULAR_NUMS}
      >
        {formattedNetWorth}
      </SizableText>
      <View
        ml="$3"
        animation="quick"
        rotate={open ? '180deg' : '0deg'}
        transformOrigin="center"
      >
        <Icon name="ChevronDownSmallSolid" color="$iconSubdued" size="$6" />
      </View>
    </Stack>
  );
}

export { ProtocolHeaderRow };
