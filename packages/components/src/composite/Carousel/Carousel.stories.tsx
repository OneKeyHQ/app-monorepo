import { StyleSheet } from 'react-native';
import { fn } from 'storybook/test';

import { Carousel } from '@onekeyhq/components/src/composite/Carousel';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';
import type { IYStackProps } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

interface ISlide {
  title: string;
  subtitle: string;
  bg: IYStackProps['bg'];
}

const SLIDES: ISlide[] = [
  {
    title: 'Back up your wallet',
    subtitle: 'Slide 1 of 3',
    bg: '$bgInfoSubdued',
  },
  {
    title: 'Track your portfolio',
    subtitle: 'Slide 2 of 3',
    bg: '$bgSuccessSubdued',
  },
  {
    title: 'Trade across chains',
    subtitle: 'Slide 3 of 3',
    bg: '$bgCautionSubdued',
  },
];

const renderSlide = ({ item }: { item: ISlide; index: number }) => (
  <YStack flex={1} ai="center" jc="center" bg={item.bg}>
    <SizableText size="$headingMd">{item.title}</SizableText>
    <SizableText size="$bodySm" color="$textSubdued">
      {item.subtitle}
    </SizableText>
  </YStack>
);

// The carousel measures its own layout, so the page area needs an explicit
// height from containerStyle (same as the SupportHub / device-guide usage).
const CONTAINER_STYLE = {
  height: 120,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: '$borderSubdued',
  borderRadius: '$4',
  overflow: 'hidden',
} as const;

// Autoplay only runs while `loop` is true and the carousel is on-screen
// (an IntersectionObserver pauses it in background tabs on web).
function CarouselDemo({
  loop = true,
  showPaginationButton = false,
  onPageChanged,
}: {
  loop?: boolean;
  showPaginationButton?: boolean;
  onPageChanged?: (index: number) => void;
}) {
  return (
    <Carousel
      data={SLIDES}
      renderItem={renderSlide}
      autoPlayInterval={3800}
      loop={loop}
      showPaginationButton={showPaginationButton}
      onPageChanged={onPageChanged}
      containerStyle={CONTAINER_STYLE}
    />
  );
}

const meta = {
  title: 'Composite/Carousel',
  component: CarouselDemo,
  args: {
    onPageChanged: fn(),
  },
} satisfies Meta<typeof CarouselDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const PaginationButtons: Story = {
  args: {
    loop: false,
    showPaginationButton: true,
  },
};
