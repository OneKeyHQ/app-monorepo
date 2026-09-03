import type { ComponentProps } from 'react';

import { InnerStroke } from '@onekeyhq/components/src/content/InnerStroke';
import { Image } from '@onekeyhq/components/src/primitives/Image';
import { Stack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

type IInnerStrokeProps = ComponentProps<typeof InnerStroke>;

const BTC_LOGO_SOURCE = {
  uri: 'https://uni.onekey-asset.com/static/chain/btc.png',
};

// The stroke is an absolutely positioned overlay that paints above
// full-bleed content; the parent must share its borderRadius and clip
// with overflow="hidden" (avatar and Discovery cards do the same).
function InnerStrokeDemo({
  borderWidth,
  borderColor,
}: Pick<IInnerStrokeProps, 'borderWidth' | 'borderColor'>) {
  return (
    <Stack w={96} h={96} borderRadius="$4" overflow="hidden" bg="$bgSubdued">
      <Image source={BTC_LOGO_SOURCE} w="100%" h="100%" />
      <InnerStroke
        borderRadius="$4"
        borderWidth={borderWidth}
        borderColor={borderColor}
      />
    </Stack>
  );
}

const meta = {
  title: 'Content/InnerStroke',
  component: InnerStrokeDemo,
  args: {
    borderWidth: 2,
    borderColor: '$borderStrong',
  },
} satisfies Meta<typeof InnerStrokeDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

// Component defaults: hairline width plus a translucent black stroke.
export const SubtleDefault: Story = {
  render: () => <InnerStrokeDemo />,
};
