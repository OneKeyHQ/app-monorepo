import { useIntl } from 'react-intl';
import Svg, { Path } from 'react-native-svg';

import { Stack, XStack, useTheme } from '@onekeyhq/components';

import {
  TRADING_VIEW_NATIVE_NAVIGATION_ACTIONS,
  TRADING_VIEW_NATIVE_NAVIGATION_BOTTOM_GAP,
  TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_RADIUS,
  TRADING_VIEW_NATIVE_NAVIGATION_ICON_SIZE,
} from '../utils/chartNavigation';
import {
  TRADING_VIEW_NATIVE_NAVIGATION_BUTTONS,
  TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_GAP,
  TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_SIZE,
} from '../utils/chartNavigationControls';

import type { ITradingViewNativeNavigationAction } from '../utils/chartNavigation';

export function TradingViewNativeNavigationControls({
  backgroundColor,
  chartWidth,
  onAction,
  timeAxisHeight,
  testID,
}: {
  backgroundColor: string;
  chartWidth: number;
  onAction: (action: ITradingViewNativeNavigationAction) => void;
  timeAxisHeight: number;
  testID?: string;
}) {
  const intl = useIntl();
  const theme = useTheme();
  const testIDPrefix = testID
    ? `${testID}-navigation`
    : 'trading-view-native-navigation';

  return (
    <XStack
      testID={`${testIDPrefix}-controls`}
      position="absolute"
      left={0}
      width={chartWidth}
      bottom={timeAxisHeight + TRADING_VIEW_NATIVE_NAVIGATION_BOTTOM_GAP}
      zIndex={2}
      justifyContent="center"
      gap={TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_GAP}
      pointerEvents="box-none"
    >
      {TRADING_VIEW_NATIVE_NAVIGATION_ACTIONS.map((action) => {
        const { labelId, path } =
          TRADING_VIEW_NATIVE_NAVIGATION_BUTTONS[action];
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
  );
}
