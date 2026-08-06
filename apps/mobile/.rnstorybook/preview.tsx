import type { PropsWithChildren } from 'react';

import { useColorScheme } from 'react-native';

import {
  ShowToastProvider,
  Toaster,
} from '@onekeyhq/components/src/actions/Toast';
import { Portal } from '@onekeyhq/components/src/hocs/Portal';
import { ConfigProvider } from '@onekeyhq/components/src/hocs/Provider';
import { OverlayContainer } from '@onekeyhq/components/src/layouts/OverlayContainer';
import { Stack } from '@onekeyhq/components/src/primitives/Stack';

import { HyperlinkTextStub } from './HyperlinkTextStub';

import type { Preview } from '@storybook/react';

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
      {children}
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
        {/* Overlay mount points for portal-based components — the minimal
            slice of the app's FullWindowOverlayContainer, in the same order:
            the FULL_WINDOW_OVERLAY portal (Dialog.show, Popover/Select
            sheets), ShowToastProvider (Toast.show custom toasts), and
            Toaster (Toast.success/error/… via backpackapp; it needs the
            GestureHandlerRootView the shell root mounts). OverlayContainer
            puts them on the iOS FullWindowOverlay layer, above the
            Storybook UI. */}
        <OverlayContainer>
          <Portal.Container name={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL} />
          <ShowToastProvider />
          <Toaster />
        </OverlayContainer>
      </ShellProvider>
    ),
  ],
};

export default preview;
