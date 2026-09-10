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
        {/* The hardware stage's mount point — deliberately OFF the
            FullWindowOverlay window, matching the app's own container
            order (FullWindowOverlayContainer mounts it beside, not
            inside): the stage sits at the main window's dialog level, so
            presentations opened over it — the in-app browser, system
            sheets — actually cover it. Canvas-wide and box-none: the
            stage positions itself, the UI behind stays live. */}
        <Stack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          pointerEvents="box-none"
        >
          <Portal.Container name={Portal.Constant.HARDWARE_UI_STATE_DIALOG} />
        </Stack>
      </ShellProvider>
    ),
  ],
};

export default preview;
