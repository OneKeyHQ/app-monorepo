import { useEffect } from 'react';

import { useIntl } from 'react-intl';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Stack, XStack, useTheme } from '@onekeyhq/components';

import {
  TRADING_VIEW_NATIVE_NAVIGATION_ACTIONS,
  TRADING_VIEW_NATIVE_NAVIGATION_BOTTOM_GAP,
  TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_RADIUS,
  TRADING_VIEW_NATIVE_NAVIGATION_ICON_SIZE,
  TRADING_VIEW_NATIVE_NAVIGATION_PRIMARY_ACTIONS,
} from '../utils/chartNavigation';
import {
  TRADING_VIEW_NATIVE_NAVIGATION_BUTTONS,
  TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_GAP,
  TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_SIZE,
  getTradingViewNativeNavigationLayout,
} from '../utils/chartNavigationControls';

import type { ITradingViewNativeNavigationAction } from '../utils/chartNavigation';

const TRADING_VIEW_NATIVE_NAVIGATION_FADE_DURATION = 200;
// Covers the chart so the buttons keep the chart's coordinate space.
const TRADING_VIEW_NATIVE_NAVIGATION_LAYER_STYLE = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  zIndex: 2,
} as const;

export function TradingViewNativeNavigationControls({
  backgroundColor,
  chartWidth,
  isResetVisible,
  isVisible,
  onAction,
  timeAxisHeight,
  testID,
}: {
  backgroundColor: string;
  chartWidth: number;
  isResetVisible: boolean;
  isVisible: boolean;
  onAction: (action: ITradingViewNativeNavigationAction) => void;
  timeAxisHeight: number;
  testID?: string;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const opacity = useSharedValue(isVisible ? 1 : 0);
  useEffect(() => {
    opacity.value = withTiming(isVisible ? 1 : 0, {
      duration: TRADING_VIEW_NATIVE_NAVIGATION_FADE_DURATION,
    });
  }, [isVisible, opacity]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const testIDPrefix = testID
    ? `${testID}-navigation`
    : 'trading-view-native-navigation';
  const actions = isResetVisible
    ? TRADING_VIEW_NATIVE_NAVIGATION_ACTIONS
    : TRADING_VIEW_NATIVE_NAVIGATION_PRIMARY_ACTIONS;
  const { primaryTrailingInset, resetButtonLeft } =
    getTradingViewNativeNavigationLayout({
      buttonSize: TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_SIZE,
      chartWidth,
      gap: TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_GAP,
    });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[TRADING_VIEW_NATIVE_NAVIGATION_LAYER_STYLE, fadeStyle]}
    >
      <XStack
        testID={`${testIDPrefix}-controls`}
        position="absolute"
        left={0}
        width={chartWidth}
        bottom={timeAxisHeight + TRADING_VIEW_NATIVE_NAVIGATION_BOTTOM_GAP}
        zIndex={2}
        justifyContent="center"
        gap={TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_GAP}
        paddingRight={primaryTrailingInset}
        // Hidden buttons let taps reach the chart, which shows them again.
        pointerEvents={isVisible ? 'box-none' : 'none'}
        accessibilityElementsHidden={!isVisible}
        importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
      >
        {actions.map((action) => {
          const { labelId, path } =
            TRADING_VIEW_NATIVE_NAVIGATION_BUTTONS[action];
          const isReset = action === 'reset';
          return (
            <Stack
              key={action}
              testID={`${testIDPrefix}-${action}`}
              accessibilityRole="button"
              accessibilityLabel={intl.formatMessage({ id: labelId })}
              alignItems="center"
              justifyContent="center"
              width={TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_SIZE}
              height={TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_SIZE}
              borderRadius={TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_RADIUS}
              borderCurve="continuous"
              borderWidth="$px"
              borderColor="$borderStrong"
              backgroundColor={backgroundColor}
              position={isReset ? 'absolute' : undefined}
              top={isReset ? 0 : undefined}
              left={isReset ? resetButtonLeft : undefined}
              pressStyle={{ opacity: 0.72 }}
              onPress={() => onAction(action)}
            >
              <Svg
                width={TRADING_VIEW_NATIVE_NAVIGATION_ICON_SIZE}
                height={TRADING_VIEW_NATIVE_NAVIGATION_ICON_SIZE}
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme.text.val}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
                accessible={false}
              >
                <Path d={path} />
              </Svg>
            </Stack>
          );
        })}
      </XStack>
    </Animated.View>
  );
}
