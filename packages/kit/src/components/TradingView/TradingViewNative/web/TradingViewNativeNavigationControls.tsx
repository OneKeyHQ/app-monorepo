import { useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';

import { Stack, XStack, useTheme } from '@onekeyhq/components';

import {
  TRADING_VIEW_NATIVE_NAVIGATION_ACTIONS,
  TRADING_VIEW_NATIVE_NAVIGATION_BOTTOM_GAP,
  TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_GAP,
  TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_RADIUS,
  TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_SIZE,
  TRADING_VIEW_NATIVE_NAVIGATION_ICON_SIZE,
} from '../utils/chartNavigation';

import type { ITradingViewNativeNavigationAction } from '../utils/chartNavigation';

// Glyphs share one visual size on a 24 px grid with thin rounded strokes, like
// TradingView's control bar, so the bar reads as a single set.
const NAVIGATION_BUTTONS: Record<
  ITradingViewNativeNavigationAction,
  { label: string; path: string }
> = {
  zoomOut: { label: 'Zoom out', path: 'M6 12h12' },
  zoomIn: { label: 'Zoom in', path: 'M6 12h12M12 6v12' },
  scrollLeft: { label: 'Scroll to the left', path: 'M14 7l-5 5 5 5' },
  scrollRight: { label: 'Scroll to the right', path: 'M10 7l5 5-5 5' },
  reset: {
    label: 'Reset chart view',
    path: 'M5.5 12a6.5 6.5 0 1 0 6.5-6.5 7.04 7.04 0 0 0-4.87 1.98L5.5 9.11M5.5 5.5v3.61h3.61',
  },
};

interface ITradingViewNativeNavigationControlsProps {
  backgroundColor: string;
  chartWidth: number;
  isVisible: boolean;
  onAction: (action: ITradingViewNativeNavigationAction) => void;
  timeAxisHeight: number;
  testID?: string;
}

export function TradingViewNativeNavigationControls({
  backgroundColor,
  chartWidth,
  isVisible,
  onAction,
  timeAxisHeight,
  testID,
}: ITradingViewNativeNavigationControlsProps) {
  const theme = useTheme();
  const iconColor = theme.text.val;
  // Keyboard focus reveals the bar; pointer focus after a click must not keep
  // it visible outside the hot zone.
  const [keyboardFocusedAction, setKeyboardFocusedAction] =
    useState<ITradingViewNativeNavigationAction | null>(null);
  const isShown = isVisible || keyboardFocusedAction !== null;
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
      gap={TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_GAP}
      opacity={isShown ? 1 : 0}
      pointerEvents={isShown ? 'box-none' : 'none'}
    >
      {TRADING_VIEW_NATIVE_NAVIGATION_ACTIONS.map((action) => {
        const { label, path } = NAVIGATION_BUTTONS[action];
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
            width={TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_SIZE}
            height={TRADING_VIEW_NATIVE_NAVIGATION_BUTTON_SIZE}
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
