import { SizableText, Stack, XStack } from '@onekeyhq/components';

import {
  PRICE_SCALE_CONTROL_WEB_SIZING,
  getTradingViewNativePriceScaleControlsLayout,
} from '../utils/priceScaleControls';

import type { ITradingViewNativePriceScaleMode } from '../types';

interface ITradingViewNativePriceScaleControlsProps {
  backgroundColor: string;
  isAutoScale: boolean;
  isLogScaleAvailable: boolean;
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
  isLogScaleAvailable,
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
    mainChartBottomInset,
    sizing: PRICE_SCALE_CONTROL_WEB_SIZING,
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
      aria-hidden={!isVisible}
    >
      <Stack
        testID={`${testIDPrefix}-auto`}
        role="button"
        aria-pressed={isAutoScale}
        tabIndex={isVisible ? 0 : -1}
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
        aria-disabled={!isLogScaleAvailable}
        tabIndex={isVisible && isLogScaleAvailable ? 0 : -1}
        alignItems="center"
        justifyContent="center"
        width={layout.buttonSize}
        height={layout.buttonSize}
        borderRadius="$1"
        borderCurve="continuous"
        borderWidth="$px"
        borderColor={isLogarithmic ? '$bgInverse' : '$borderStrong'}
        backgroundColor={logBackgroundColor}
        cursor={isLogScaleAvailable ? 'pointer' : 'default'}
        opacity={isLogScaleAvailable ? 1 : 0.45}
        hoverStyle={isLogScaleAvailable ? { opacity: 0.86 } : undefined}
        pressStyle={isLogScaleAvailable ? { opacity: 0.72 } : undefined}
        onPress={isLogScaleAvailable ? onLogScalePress : undefined}
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
