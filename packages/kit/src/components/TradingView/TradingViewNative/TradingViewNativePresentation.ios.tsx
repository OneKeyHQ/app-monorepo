import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';

import { Stack } from '@onekeyhq/components';

import type { ITradingViewNativePresentationProps } from './TradingViewNativePresentation';

export function TradingViewNativePresentation({
  children,
  isFullscreen,
}: ITradingViewNativePresentationProps) {
  return (
    <FullWindowOverlay
      inlinePresentation={!isFullscreen}
      belowWindowOverlays
      unstable_accessibilityContainerViewIsModal={isFullscreen}
    >
      <Stack
        flex={1}
        bg={isFullscreen ? '$bgApp' : '$transparent'}
        collapsable={false}
        testID={
          isFullscreen
            ? 'trading-view-native-fullscreen-layer'
            : 'trading-view-native-inline-layer'
        }
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider style={{ flex: 1 }}>
            <SafeAreaView
              style={{ flex: 1 }}
              edges={isFullscreen ? undefined : []}
            >
              {children}
            </SafeAreaView>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </Stack>
    </FullWindowOverlay>
  );
}

export function TradingViewNativeFullscreenHost() {
  return null;
}
