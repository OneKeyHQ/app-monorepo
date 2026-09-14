import { fn } from 'storybook/test';

import { Popover } from '@onekeyhq/components/src/actions/Popover';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const PLACEMENTS = [
  'bottom-start',
  'bottom',
  'bottom-end',
  'top-start',
  'top',
  'top-end',
  'left',
  'right',
] as const;

const FEE_CONTENT = (
  <YStack p="$4" gap="$2">
    <SizableText size="$bodyMd">
      Fees are estimated from current network congestion and adjust in real
      time.
    </SizableText>
    <SizableText size="$bodyMd" color="$textSubdued">
      The final cost is always shown before you sign.
    </SizableText>
  </YStack>
);

// renderContent also accepts a component and injects `closePopover`, which is
// how app code dismisses the popover from inside its own content.
function ClosableContent({
  closePopover,
}: {
  isOpen?: boolean;
  closePopover: () => void;
}) {
  return (
    <YStack p="$4" gap="$3">
      <SizableText size="$bodyMd">
        Your address changes after every payment to protect your privacy. Old
        addresses keep working.
      </SizableText>
      <Button size="small" alignSelf="flex-end" onPress={closePopover}>
        Got it
      </Button>
    </YStack>
  );
}

const meta = {
  title: 'Actions/Popover',
  component: Popover,
  args: {
    title: 'About fees',
    renderTrigger: <Button alignSelf="flex-start">About fees</Button>,
    renderContent: FEE_CONTENT,
    placement: 'bottom-start',
    onOpenChange: fn(),
  },
  argTypes: {
    placement: { control: 'select', options: PLACEMENTS },
    title: { control: 'text' },
  },
} satisfies Meta<typeof Popover>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const PlacementTop: Story = {
  args: { placement: 'top-start' },
};

export const WithCloseAction: Story = {
  args: {
    title: 'Address privacy',
    renderTrigger: <Button alignSelf="flex-start">Why did it change?</Button>,
    renderContent: ClosableContent,
  },
};
