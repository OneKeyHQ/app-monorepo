import { fn } from 'storybook/test';

import { ButtonGroup } from '@onekeyhq/components/src/primitives/ButtonGroup';
import { Icon } from '@onekeyhq/components/src/primitives/Icon';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Joined pager-style control; `disabled` on the group cascades to every item
// through context.
function ButtonGroupDemo({
  disabled = false,
  orientation = 'horizontal',
  onPrev,
  onNext,
}: {
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <ButtonGroup disabled={disabled} orientation={orientation}>
      <ButtonGroup.Item onPress={onPrev}>
        <Icon name="ChevronLeftSmallOutline" size="$5" />
      </ButtonGroup.Item>
      <ButtonGroup.Item>
        <SizableText size="$bodyMdMedium" px="$2">
          2 / 10
        </SizableText>
      </ButtonGroup.Item>
      <ButtonGroup.Item onPress={onNext}>
        <Icon name="ChevronRightSmallOutline" size="$5" />
      </ButtonGroup.Item>
    </ButtonGroup>
  );
}

const meta = {
  title: 'Primitives/ButtonGroup',
  component: ButtonGroupDemo,
  args: {
    onPrev: fn(),
    onNext: fn(),
  },
} satisfies Meta<typeof ButtonGroupDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
};
