/* oxlint-disable import-js/order -- evaluation order is load-bearing here:
   `./injectTamaguiCss` (which itself runs `./polyfills` first) must execute
   before any component module evaluates, and alphabetical sorting would move
   it after them. */
import './injectTamaguiCss';

import '@onekeyhq/components/src/hocs/Provider/web-fonts.css';
import '@onekeyhq/shared/src/web/index.css';

import { ConfigProvider } from '@onekeyhq/components/src/hocs/Provider';
import { Stack } from '@onekeyhq/components/src/primitives/Stack';

import { HyperlinkTextStub } from './HyperlinkTextStub';

import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import type { Preview } from '@storybook/react-native-web-vite';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      // SB9 renamed `viewports` -> `options`; these drive the toolbar sizes.
      options: {
        mobile: {
          name: 'Mobile 360',
          styles: { width: '360px', height: '780px' },
        },
        tablet: {
          name: 'Tablet 768',
          styles: { width: '768px', height: '1024px' },
        },
        laptop: {
          name: 'Laptop 960',
          styles: { width: '960px', height: '720px' },
        },
        desktop: {
          name: 'Desktop 1440',
          styles: { width: '1440px', height: '900px' },
        },
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Tamagui theme',
      toolbar: {
        title: 'Theme',
        icon: 'contrast',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'App locale',
      toolbar: {
        title: 'Locale',
        icon: 'globe',
        items: [
          { value: 'en-US', title: 'English' },
          { value: 'zh-CN', title: '简体中文' },
          { value: 'zh-TW', title: '繁體中文' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'light',
    locale: 'en-US',
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals.theme as 'light' | 'dark') ?? 'light';
      const locale = (context.globals.locale as ILocaleSymbol) ?? 'en-US';
      return (
        // Remounting on theme/locale change (via key) avoids stale Tamagui theme
        // context lingering across toolbar switches.
        <ConfigProvider
          key={`${theme}-${locale}`}
          theme={theme}
          locale={locale}
          HyperlinkText={HyperlinkTextStub}
        >
          <Stack bg="$bgApp" p="$5" minHeight="100%">
            <Story />
          </Stack>
        </ConfigProvider>
      );
    },
  ],
  tags: ['autodocs'],
};

export default preview;
