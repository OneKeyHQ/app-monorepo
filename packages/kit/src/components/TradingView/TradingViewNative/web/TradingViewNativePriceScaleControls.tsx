import { SizableText, Stack, XStack } from '@onekeyhq/components';

import { getTradingViewNativePriceScaleControlsLayout } from '../utils/priceScaleControls';

import type { ITradingViewNativePriceScaleMode } from '../types';

const WEB_PRICE_SCALE_CONTROL_SIZE = 20;
const WEB_PRICE_SCALE_CONTROL_MIN_SIZE = 16;
const WEB_PRICE_SCALE_CONTROL_GAP = 3;

interface ITradingViewNativePriceScaleControlsProps {
  backgroundColor: string;
  isAutoScale: boolean;
  isVisible: boolean;
  mainChartBottomInset: number;
  onAutoScalePress: () => void;
  onLogScalePress: () => void;
  priceAxisWidth: number;
  priceScaleMode: ITradingViewNativePriceScaleMode;
  testID?: string;
}

export function TradingViewNativePriceScaleControls({
  backgroundColor,
  isAutoScale,
  isVisible,
  mainChartBottomInset,
  onAutoScalePress,
  onLogScalePress,
  priceAxisWidth,
  priceScaleMode,
  testID,
}: ITradingViewNativePriceScaleControlsProps) {
  const testIDPrefix = testID
    ? `${testID}-price-scale`
    : 'trading-view-native-price-scale';
  const layout = getTradingViewNativePriceScaleControlsLayout(priceAxisWidth, {
    gap: WEB_PRICE_SCALE_CONTROL_GAP,
    mainChartBottomInset,
    minimumButtonSize: WEB_PRICE_SCALE_CONTROL_MIN_SIZE,
    preferredButtonSize: WEB_PRICE_SCALE_CONTROL_SIZE,
  });

  if (!layout) {
    return null;
  }

  const autoBackgroundColor = isAutoScale ? '$bgInverse' : backgroundColor;
  const isLogarithmic = priceScaleMode === 'logarithmic';
  const logBackgroundColor = isLogarithmic ? '$bgInverse' : backgroundColor;

  return (
    <XStack
      testID={`${testIDPrefix}-controls`}
      position="absolute"
      right={layout.right}
      bottom={layout.bottom}
      zIndex={2}
      width={layout.width}
      height={layout.buttonSize}
      gap={layout.gap}
      borderRadius="$1"
      backgroundColor={backgroundColor}
      opacity={isVisible ? 1 : 0}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      <Stack
        testID={`${testIDPrefix}-auto`}
        role="button"
        aria-pressed={isAutoScale}
        tabIndex={0}
        alignItems="center"
        justifyContent="center"
        width={layout.buttonSize}
        height={layout.buttonSize}
        borderRadius="$1"
        borderCurve="continuous"
        borderWidth="$px"
        borderColor={isAutoScale ? '$bgInverse' : '$borderStrong'}
        backgroundColor={autoBackgroundColor}
        cursor="pointer"
        hoverStyle={{ opacity: 0.86 }}
        pressStyle={{ opacity: 0.72 }}
        onPress={onAutoScalePress}
      >
        <SizableText
          fontSize={12}
          lineHeight={16}
          fontWeight="500"
          color={isAutoScale ? '$textInverse' : '$text'}
          userSelect="none"
        >
          A
        </SizableText>
      </Stack>
      <Stack
        testID={`${testIDPrefix}-log`}
        role="button"
        aria-pressed={isLogarithmic}
        tabIndex={0}
        alignItems="center"
        justifyContent="center"
        width={layout.buttonSize}
        height={layout.buttonSize}
        borderRadius="$1"
        borderCurve="continuous"
        borderWidth="$px"
        borderColor={isLogarithmic ? '$bgInverse' : '$borderStrong'}
        backgroundColor={logBackgroundColor}
        cursor="pointer"
        hoverStyle={{ opacity: 0.86 }}
        pressStyle={{ opacity: 0.72 }}
        onPress={onLogScalePress}
      >
        <SizableText
          fontSize={12}
          lineHeight={16}
          fontWeight="500"
          color={isLogarithmic ? '$textInverse' : '$text'}
          userSelect="none"
        >
          L
        </SizableText>
      </Stack>
    </XStack>
  );
}
