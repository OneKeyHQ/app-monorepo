import { Label } from '@onekeyhq/components/src/primitives/Label';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const VARIANT_RAMP = [
  '$bodyLgMedium',
  '$bodyMdMedium',
  '$bodySmMedium',
] as const;

// Form-field caption: `variant` picks the font token ($bodyMdMedium default).
const meta = {
  title: 'Primitives/Label',
  component: Label,
  args: {
    children: 'Wallet name',
  },
} satisfies Meta<typeof Label>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <YStack gap="$2">
      {VARIANT_RAMP.map((variant) => (
        <Label key={variant} variant={variant}>
          {variant}
        </Label>
      ))}
    </YStack>
  ),
};
