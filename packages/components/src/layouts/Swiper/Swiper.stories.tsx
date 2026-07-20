import { fn } from 'storybook/test';

import { Swiper } from '@onekeyhq/components/src/layouts/Swiper';
import type { IRenderPaginationParams } from '@onekeyhq/components/src/layouts/Swiper';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import {
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components/src/primitives/Stack';
import type { IYStackProps } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { ListRenderItem } from 'react-native';

interface IBannerSlide {
  title: string;
  bg: IYStackProps['bg'];
}

const SLIDES: IBannerSlide[] = [
  { title: 'Back up your wallet', bg: '$bgInfoSubdued' },
  { title: 'Track your portfolio', bg: '$bgSuccessSubdued' },
  { title: 'Trade across chains', bg: '$bgCautionSubdued' },
];

const renderSlide: ListRenderItem<IBannerSlide> = ({ item }) => (
  <YStack flex={1} ai="center" jc="center" bg={item.bg}>
    <SizableText size="$headingMd">{item.title}</SizableText>
  </YStack>
);

const keyExtractor = (item: IBannerSlide) => item.title;

const renderDots = ({ currentIndex }: IRenderPaginationParams) => (
  <XStack position="absolute" bottom="$2" alignSelf="center" gap="$1.5">
    {SLIDES.map((slide, index) => (
      <Stack
        key={slide.title}
        w="$1.5"
        h="$1.5"
        borderRadius="$full"
        bg={index === currentIndex ? '$icon' : '$iconDisabled'}
      />
    ))}
  </XStack>
);

// Horizontal paging list (FlashList on native, FlatList + bespoke mouse-drag
// on web). `height` is mandatory — pages fill the measured container width.
function SwiperDemo({
  autoplay = true,
  onChangeIndex,
}: {
  autoplay?: boolean;
  onChangeIndex?: (item: { index: number; prevIndex: number }) => void;
}) {
  return (
    <YStack w={320}>
      <Swiper
        height={140}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={keyExtractor}
        autoplay={autoplay}
        autoplayDelayMs={2500}
        autoplayLoop
        renderPagination={renderDots}
        onChangeIndex={onChangeIndex}
        borderRadius="$3"
        overflow="hidden"
      />
    </YStack>
  );
}

const meta = {
  title: 'Layouts/Swiper',
  component: SwiperDemo,
  args: {
    onChangeIndex: fn(),
  },
} satisfies Meta<typeof SwiperDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const GestureOnly: Story = {
  args: {
    autoplay: false,
  },
};
