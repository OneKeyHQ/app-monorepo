import { Tooltip } from '@onekeyhq/components/src/actions/Tooltip';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const PLACEMENTS = [
  'top',
  'top-start',
  'top-end',
  'bottom',
  'bottom-start',
  'bottom-end',
  'left',
  'right',
] as const;

// Tooltip is hover-driven and web/desktop-only: the native implementation
// renders just the trigger (index.native.tsx), so on the on-device shell
// these stories show a bare button by design.
const meta = {
  title: 'Actions/Tooltip',
  component: Tooltip,
  args: {
    renderTrigger: <Button alignSelf="flex-start">Hover me</Button>,
    renderContent: 'Estimated network fee for this transaction',
    placement: 'bottom',
  },
  argTypes: {
    placement: { control: 'select', options: PLACEMENTS },
    renderContent: { control: 'text' },
  },
  decorators: [
    // Same trap as ActionList: in the preview's full-width column the
    // tooltip's trigger wrapper stretches and floating-ui anchors to the
    // full row instead of the button. A row wrapper restores content sizing.
    (Story) => (
      <XStack>
        <Story />
      </XStack>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const PlacementRight: Story = {
  args: {
    renderTrigger: <Button alignSelf="flex-start">Hover me</Button>,
    placement: 'right',
  },
};

export const LongContent: Story = {
  args: {
    renderTrigger: (
      <Button alignSelf="flex-start">Why is this estimated?</Button>
    ),
    renderContent:
      'Network fees fluctuate with congestion. The estimate refreshes every block; the exact amount is locked in when you sign.',
  },
};
