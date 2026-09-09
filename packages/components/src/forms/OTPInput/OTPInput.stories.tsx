import { useState } from 'react';

import { fn } from 'storybook/test';

import { OTPInput } from '@onekeyhq/components/src/forms/OTPInput';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// OTPInput is fully controlled: keep the value in state and feed keystrokes
// back through onTextChange. onComplete fires once value.length reaches
// numberOfDigits. The component defaults autoFocus to true; stories turn it
// off so opening one doesn't steal focus (web) or pop the keyboard (native).
function OTPInputDemo({
  initialValue = '',
  ...rest
}: {
  initialValue?: string;
  numberOfDigits: number;
  status?: 'error' | 'normal';
  autoFocus?: boolean;
  onComplete?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return <OTPInput {...rest} value={value} onTextChange={setValue} />;
}

const meta = {
  title: 'Forms/OTPInput',
  component: OTPInputDemo,
  args: {
    numberOfDigits: 6,
    autoFocus: false,
    onComplete: fn(),
  },
  argTypes: {
    numberOfDigits: { control: { type: 'number', min: 4, max: 8 } },
    status: { control: 'radio', options: ['normal', 'error'] },
  },
  decorators: [
    (Story) => (
      // The app renders OTPInput inside dialog-width containers; unconstrained
      // it stretches its cells across the full canvas.
      <YStack maxWidth={360}>
        <Story />
      </YStack>
    ),
  ],
} satisfies Meta<typeof OTPInputDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

// A prefilled wrong code: error status turns the cell borders critical.
// Typing again resets the status to normal.
export const ErrorState: Story = {
  args: {
    initialValue: '423910',
    status: 'error',
  },
};
