import { NavigationContainer } from '@react-navigation/native';
import { fn } from 'storybook/test';

import { Banner } from '@onekeyhq/components/src/composite/Banner';
import type { IBannerData } from '@onekeyhq/components/src/composite/Banner';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const BANNER_DATA: IBannerData[] = [
  {
    bannerId: 'hero',
    title: 'Secure your assets',
    imgUrl:
      'https://asset.onekey-asset.com/portal/803ff853ecdd7808b35fdf6f837ae1af514aad56/static/shop-hero-animation-poster-8e1206b59d2201dfaa8cd72a8134179f.jpg',
    theme: 'light',
  },
  {
    bannerId: 'pro',
    title: 'Meet OneKey Pro',
    imgUrl:
      'https://uni-test.onekey-asset.com/dashboard/banner/upload_1718048882212.0.9766924574052163.0.png',
    theme: 'dark',
  },
];

// Banner calls useIsFocused() unconditionally, so every story mounts
// inside a bare NavigationContainer — no navigator needed; the empty
// container reports focused, which drives autoplay. Data must be
// non-empty with isLoading={false}, or only emptyComponent renders.
// Banner stretches to its parent, so a column decorator bounds the
// width (a row would let it collapse on native); Discovery renders it
// at 360 the same way.
const meta = {
  title: 'Composite/Banner',
  component: Banner,
  args: {
    data: BANNER_DATA,
    isLoading: false,
    height: 160,
    onItemPress: fn(),
  },
  decorators: [
    (Story) => (
      <NavigationContainer>
        <YStack w={360}>
          <Story />
        </YStack>
      </NavigationContainer>
    ),
  ],
} satisfies Meta<typeof Banner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithCloseButton: Story = {
  args: {
    showCloseButton: true,
    onBannerClose: fn(),
  },
};
