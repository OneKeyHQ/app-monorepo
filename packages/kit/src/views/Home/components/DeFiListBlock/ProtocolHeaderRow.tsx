import { StyleSheet } from 'react-native';

import {
  Icon,
  SizableText,
  Stack,
  View,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
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
  // 12 mirrors the parent card's $3 (= 12px) radius. Hardcoded because
  // the value participates in a JS-driven interpolation that runs every
  // scroll frame; reading from Tamagui tokens at render time would
  // pin the card to whichever theme was active when first measured.
  const topRadius = 12 * (1 - progress);
  const shellOpacity = overlay ? 1 : 1 - progress;
  const isInteractive = Boolean(onPress);
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
      bg="$bgApp"
      // Hairline edge is conditional: when this header *is* the card
      // (overlay/pinned mode floating in a portal) it owns its own
      // outer edge; when it sits inside ProtocolDesktopLayout the
      // outer card border is the only edge — drawing one here too would
      // render a visible double-line ~1px inside the card.
      borderWidth={overlay ? StyleSheet.hairlineWidth : 0}
      borderColor={overlay ? '$borderSubdued' : 'transparent'}
      borderTopLeftRadius={topRadius}
      borderTopRightRadius={topRadius}
      borderBottomLeftRadius={overlay ? '$3' : 0}
      borderBottomRightRadius={overlay ? '$3' : 0}
      borderCurve="continuous"
      cursor={isInteractive ? 'pointer' : undefined}
      animation={reducedMotion ? undefined : 'quick'}
      animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
      opacity={shellOpacity}
      pointerEvents={!overlay && progress >= 0.999 ? 'none' : undefined}
      hoverStyle={isInteractive ? { bg: '$bgApp' } : undefined}
      pressStyle={isInteractive ? { bg: '$bgApp', scale: 0.995 } : undefined}
      onPress={onPress}
      role={isInteractive ? 'button' : undefined}
      aria-label={isInteractive ? name : undefined}
      $platform-web={{
        // border-radius is the only animated property: topRadius is
        // JS-interpolated each scroll frame, the CSS transition just
        // smooths inter-frame jitter.
        transition: 'border-radius 140ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <XStack
        gap="$3"
        alignItems="center"
        flex={1}
        minWidth={0}
        animation={reducedMotion ? undefined : 'quick'}
        animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
      >
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
      <SizableText
        size="$headingLg"
        numberOfLines={1}
        textAlign="right"
        minWidth={120}
        maxWidth={168}
        color="$text"
        fontVariant={TABULAR_NUMS}
        animation={reducedMotion ? undefined : 'quick'}
        animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
      >
        {formattedNetWorth}
      </SizableText>
      <View
        ml="$3"
        animation={reducedMotion ? undefined : 'quick'}
        animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
        rotate={open ? '180deg' : '0deg'}
        transformOrigin="center"
      >
        <Icon name="ChevronDownSmallSolid" color="$iconSubdued" size="$6" />
      </View>
    </Stack>
  );
}

export { ProtocolHeaderRow };
