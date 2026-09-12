import type { PropsWithChildren } from 'react';

import { useColorScheme } from 'react-native';
import {
  SafeAreaInsetsContext,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import {
  ShowToastProvider,
  Toaster,
} from '@onekeyhq/components/src/actions/Toast';
import { Portal } from '@onekeyhq/components/src/hocs/Portal';
import { ConfigProvider } from '@onekeyhq/components/src/hocs/Provider';
import { OverlayContainer } from '@onekeyhq/components/src/layouts/OverlayContainer';
import { Stack } from '@onekeyhq/components/src/primitives/Stack';
import { HARDWARE_STAGE_Z_INDEX } from '@onekeyhq/shared/src/consts/zIndexConsts';

import { HyperlinkTextStub } from './HyperlinkTextStub';

import type { Preview } from '@storybook/react';

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
          {/* The hardware stage's mount point — INSIDE the
              FullWindowOverlay window, because that is where the app
              mounts it since 8c0391dfa8 (the stage must cover native
              modal pages on iOS). Keeping the shell on the same window
              means on-device rounds exercise the window's geometry and
              touch delivery; the app additionally nests the stage in its
              own OverlayContainer with a raise token (OK-62422), which
              this shell does not replay. The wrapper mirrors the app's
              (FullWindowOverlayContainer): a viewport on the
              pass-through platforms — OverlayContainer is a full-window
              host only on iOS, and MorphOverlay's layer anchors absolute
              to fill it — kept as a native view, since RN 0.86 Fabric
              flattens a layout-only box-none container and kills
              hit-testing for the whole portal subtree. */}
          <Stack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            zIndex={HARDWARE_STAGE_Z_INDEX}
            pointerEvents="box-none"
            collapsable={false}
          >
            <Portal.Container name={Portal.Constant.HARDWARE_UI_STATE_DIALOG} />
          </Stack>
          <ShowToastProvider />
          <Toaster />
        </OverlayContainer>
      </ShellProvider>
    ),
  ],
};

export default preview;
