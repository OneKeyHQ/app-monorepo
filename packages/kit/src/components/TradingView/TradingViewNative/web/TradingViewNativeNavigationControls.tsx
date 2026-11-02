import { useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';

import { useIntl } from 'react-intl';

import { Stack, XStack, useTheme } from '@onekeyhq/components';

import {
  TRADING_VIEW_NATIVE_NAVIGATION_ACTIONS,
  TRADING_VIEW_NATIVE_NAVIGATION_BOTTOM_GAP,
  TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_GAP,
  TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_RADIUS,
  TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_SIZE,
  TRADING_VIEW_NATIVE_NAVIGATION_ICON_SIZE,
} from '../utils/chartNavigation';
import {
  TRADING_VIEW_NATIVE_NAVIGATION_BUTTONS,
  TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_GAP,
  TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_SIZE,
} from '../utils/chartNavigationControls';

import type { ITradingViewNativeNavigationAction } from '../utils/chartNavigation';

interface ITradingViewNativeNavigationControlsProps {
  backgroundColor: string;
  chartWidth: number;
  isVisible: boolean;
  isMobileLayout?: boolean;
  onAction: (action: ITradingViewNativeNavigationAction) => void;
  timeAxisHeight: number;
  testID?: string;
}

export function TradingViewNativeNavigationControls({
  backgroundColor,
  chartWidth,
  isVisible,
  isMobileLayout = false,
  onAction,
  timeAxisHeight,
  testID,
}: ITradingViewNativeNavigationControlsProps) {
  const intl = useIntl();
  const theme = useTheme();
  const iconColor = theme.text.val;
  // Keyboard focus reveals the bar; pointer focus after a click must not keep
  // it visible outside the hot zone.
  const [keyboardFocusedAction, setKeyboardFocusedAction] =
    useState<ITradingViewNativeNavigationAction | null>(null);
  const isShown = isVisible || keyboardFocusedAction !== null;
  const buttonSize = isMobileLayout
    ? TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_SIZE
    : TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_SIZE;
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
      gap={
        isMobileLayout
          ? TRADING_VIEW_NATIVE_NAVIGATION_TOUCH_BUTTON_GAP
          : TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_GAP
      }
      opacity={isShown ? 1 : 0}
      pointerEvents={isShown ? 'box-none' : 'none'}
    >
      {TRADING_VIEW_NATIVE_NAVIGATION_ACTIONS.map((action) => {
        const { labelId, path } =
          TRADING_VIEW_NATIVE_NAVIGATION_BUTTONS[action];
        const label = intl.formatMessage({ id: labelId });
        const updateKeyboardFocus = (
          event: FocusEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
        ) => {
          setKeyboardFocusedAction(
            event.currentTarget.matches(':focus-visible') ? action : null,
          );
        };
        return (
          <Stack
            key={action}
            render={<button type="button" aria-label={label} />}
            testID={`${testIDPrefix}-${action}`}
            aria-label={label}
            alignItems="center"
            justifyContent="center"
            width={buttonSize}
            height={buttonSize}
            padding={0}
            borderRadius={TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_RADIUS}
            borderCurve="continuous"
            borderWidth="$px"
            borderColor="$borderStrong"
            backgroundColor={backgroundColor}
            cursor="pointer"
            pointerEvents={isShown ? 'auto' : 'none'}
            hoverStyle={{ opacity: 0.86 }}
            pressStyle={{ opacity: 0.72 }}
            focusVisibleStyle={{
              outlineColor: '$iconActive',
              outlineWidth: 2,
              outlineStyle: 'solid',
              outlineOffset: -2,
            }}
            onFocus={updateKeyboardFocus}
            onKeyDown={updateKeyboardFocus}
            onBlur={() =>
              setKeyboardFocusedAction((currentAction) =>
                currentAction === action ? null : currentAction,
              )
            }
            onPointerDown={() => setKeyboardFocusedAction(null)}
            onPress={() => onAction(action)}
          >
            <svg
              width={TRADING_VIEW_NATIVE_NAVIGATION_ICON_SIZE}
              height={TRADING_VIEW_NATIVE_NAVIGATION_ICON_SIZE}
              viewBox="0 0 24 24"
              fill="none"
              stroke={iconColor}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              focusable="false"
            >
              <path d={path} />
            </svg>
          </Stack>
        );
      })}
    </XStack>
  );
}
