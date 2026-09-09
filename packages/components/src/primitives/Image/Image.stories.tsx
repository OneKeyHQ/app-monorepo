import { Icon } from '@onekeyhq/components/src/primitives/Icon';
import { Image } from '@onekeyhq/components/src/primitives/Image';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const BTC_LOGO_URI = 'https://uni.onekey-asset.com/static/chain/btc.png';

const FALLBACK_ICON = (
  <Icon name="ImageMountainsOutline" size="$16" color="$iconSubdued" />
);

// Image has no default dimensions — the skeleton and fallback both size
// themselves from the style, so always pass w/h (or size).
const meta = {
  title: 'Primitives/Image',
  component: Image,
  args: {
    source: { uri: BTC_LOGO_URI },
    w: '$16',
    h: '$16',
  },
} satisfies Meta<typeof Image>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Rounded: Story = {
  args: {
    borderRadius: '$full',
  },
};

// A dead URI fails and the fallback node renders.
export const Fallback: Story = {
  args: {
    source: { uri: 'https://uni.onekey-asset.com/static/chain/missing.png' },
    fallback: FALLBACK_ICON,
  },
};
