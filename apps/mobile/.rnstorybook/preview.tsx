import { Portal } from '@onekeyhq/components/src/hocs/Portal';
import { ConfigProvider } from '@onekeyhq/components/src/hocs/Provider';
import { OverlayContainer } from '@onekeyhq/components/src/layouts/OverlayContainer';
import { Stack } from '@onekeyhq/components/src/primitives/Stack';

import { HyperlinkTextStub } from './HyperlinkTextStub';

import type { Preview } from '@storybook/react';

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
      // Fixed theme/locale for the spike — the on-device UI has no toolbar
      // globals like the web playground's; wire real switching in a build-out.
      <ConfigProvider
        theme="light"
        locale="en-US"
        HyperlinkText={HyperlinkTextStub}
      >
        <Stack bg="$bgApp" p="$5" flex={1}>
          <Story />
        </Stack>
        {/* Overlay mount point for portal-based components (Dialog.show,
            Popover/Select sheets) — the minimal slice of the app's
            FullWindowOverlayContainer. OverlayContainer puts it on the iOS
            FullWindowOverlay layer, above the Storybook UI. */}
        <OverlayContainer>
          <Portal.Container name={Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL} />
        </OverlayContainer>
      </ConfigProvider>
    ),
  ],
};

export default preview;
