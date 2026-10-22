import type { PropsWithChildren } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';
import { useColorScheme } from 'react-native';
import {
  SafeAreaInsetsContext,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import { Toaster } from '@onekeyhq/components/src/actions/Toast';
import { ConfigProvider } from '@onekeyhq/components/src/hocs/Provider';
import { Stack } from '@onekeyhq/components/src/primitives/Stack';
import { ImperativeOverlayMountHost } from '@onekeyhq/components/src/shared/imperativeOverlayMount';

import { HyperlinkTextStub } from './HyperlinkTextStub';

import type { Preview } from '@storybook/react';

const HOST_ANIMATION = { enter: { type: 'none' } } as const;

const WINDOW_INSETS = initialWindowMetrics?.insets ?? {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

function ShellProvider({ children }: PropsWithChildren) {
  // Theme follows the system appearance — the on-device UI has no toolbar
  // globals like the web playground's, and the OS dark-mode toggle is a
  // switch every dev already has (Simulator ⇧⌘A). Remounting on change (key)
  // mirrors the web playground's guard against stale Tamagui theme context.
  // Locale stays fixed for the spike.
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? 'dark' : 'light';
  return (
    <ConfigProvider
      key={theme}
      theme={theme}
      locale="en-US"
      HyperlinkText={HyperlinkTextStub}
    >
      {/* Window insets for the whole decorated tree: ConfigProvider's own
          SafeAreaProvider measures the story canvas — a view already
          under the Storybook chrome, so its top inset settles at 0 once
          the native view reports — while components that seat
          themselves against the real status bar band (the hardware
          stage, the toasts) read the app's root provider in production.
          The main window's launch metrics stand in for it here. */}
      <SafeAreaInsetsContext.Provider value={WINDOW_INSETS}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </ConfigProvider>
  );
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <ShellProvider>
        <Stack bg="$bgApp" p="$5" flex={1}>
          <Story />
        </Stack>
        {/* Match the app's unfrozen imperative hosts while each overlay keeps
            its own SDK level. Toaster uses the shell's gesture root. */}
        <ImperativeOverlayMountHost target="global" />
        <ImperativeOverlayMountHost target="page" />
        <OverlayView
          visible
          level="hardware"
          presentation="fullscreen"
          animation={HOST_ANIMATION}
          blocking={false}
          backdrop={false}
          dismissOnBackPress={false}
        >
          <ImperativeOverlayMountHost target="hardware-stage" />
        </OverlayView>
        <OverlayView
          visible
          level="toast"
          presentation="fullscreen"
          animation={HOST_ANIMATION}
          blocking={false}
          backdrop={false}
          dismissOnBackPress={false}
        >
          <Toaster />
        </OverlayView>
      </ShellProvider>
    ),
  ],
};

export default preview;
