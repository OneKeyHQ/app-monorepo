import { ConfigProvider } from '@onekeyhq/components/src/hocs/Provider';
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
      </ConfigProvider>
    ),
  ],
};

export default preview;
