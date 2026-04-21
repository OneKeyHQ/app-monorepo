import { StyleSheet } from 'react-native';

import {
  Icon,
  SizableText,
  Stack,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY_TRANSFORM,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';

export type IProtocolHeaderRowProps = {
  name: string;
  logo?: string;
  networkId: string;
  currencySymbol: string;
  netWorth: number | string;
  isAllNetworks?: boolean;
  positionCountText?: string;
  open?: boolean;
  compactProgress?: number;
  overlay?: boolean;
  reducedMotion?: boolean;
  onPress?: () => void;
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
  compactProgress = 0,
  overlay,
  reducedMotion,
  onPress,
}: IProtocolHeaderRowProps) {
  const progress = Math.max(0, Math.min(1, compactProgress));
  const topRadius = 12 * (1 - progress);
  const isInteractive = Boolean(onPress);

  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      px="$5"
      py="$3"
      bg="$bgSubdued"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderTopLeftRadius={topRadius}
      borderTopRightRadius={topRadius}
      borderBottomLeftRadius={overlay ? '$3' : 0}
      borderBottomRightRadius={overlay ? '$3' : 0}
      borderCurve="continuous"
      cursor={isInteractive ? 'pointer' : undefined}
      animation={reducedMotion ? undefined : 'quick'}
      animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
      hoverStyle={isInteractive ? { bg: '$bgSubdued' } : undefined}
      pressStyle={
        isInteractive ? { bg: '$bgSubdued', scale: 0.995 } : undefined
      }
      onPress={onPress}
      role={isInteractive ? 'button' : undefined}
      aria-label={isInteractive ? name : undefined}
      $platform-web={{
        boxShadow:
          overlay || progress >= 0.999
            ? 'none'
            : '0 1px 2px rgba(0, 0, 0, 0.04)',
        transition:
          'border-radius 140ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 140ms cubic-bezier(0.22, 1, 0.36, 1), background-color 140ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <XStack gap="$3" alignItems="center" flex={1} minWidth={0}>
        <Token
          size="md"
          tokenImageUri={logo}
          showNetworkIcon={isAllNetworks}
          networkId={networkId}
        />
        <YStack flex={1} minWidth={0} alignItems="flex-start">
          <SizableText
            size="$headingLg"
            numberOfLines={1}
            color="$text"
            animation={reducedMotion ? undefined : 'quick'}
            animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
          >
            {name}
          </SizableText>
          {positionCountText ? (
            <SizableText
              size="$headingSm"
              numberOfLines={1}
              color="$textSubdued"
              animation={reducedMotion ? undefined : 'quick'}
              animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
              opacity={1}
              pointerEvents="none"
            >
              {positionCountText}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
      <NumberSizeableTextWrapper
        hideValue
        size="$headingLg"
        formatter="value"
        formatterOptions={{ currency: currencySymbol }}
        numberOfLines={1}
        textAlign="right"
        minWidth={120}
        maxWidth={168}
        color="$text"
        animation={reducedMotion ? undefined : 'quick'}
        animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
      >
        {netWorth}
      </NumberSizeableTextWrapper>
      <View
        ml="$3"
        animation={reducedMotion ? undefined : 'quick'}
        animateOnly={ANIMATE_ONLY_TRANSFORM}
        rotate={open ? '180deg' : '0deg'}
        opacity={1}
        transformOrigin="center"
      >
        <Icon name="ChevronDownSmallSolid" color="$iconSubdued" size="$6" />
      </View>
    </Stack>
  );
}

export { ProtocolHeaderRow };
