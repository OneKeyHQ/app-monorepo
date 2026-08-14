import { useCallback, useState } from 'react';

import { fn } from 'storybook/test';

import { Select } from '@onekeyhq/components/src/forms/Select';
import type {
  ISelectItem,
  ISelectProps,
  ISelectSection,
} from '@onekeyhq/components/src/forms/Select/type';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const NETWORK_ITEMS: ISelectItem[] = [
  { label: 'Bitcoin', value: 'btc' },
  { label: 'Ethereum', value: 'eth', description: 'Includes L2 accounts' },
  { label: 'Solana', value: 'sol' },
  { label: 'Tron', value: 'trx', disabled: true },
  { label: 'Litecoin', value: 'ltc' },
];

const NETWORK_SECTIONS: ISelectSection[] = [
  {
    title: 'Mainnets',
    data: [
      { label: 'Bitcoin', value: 'btc' },
      { label: 'Ethereum', value: 'eth' },
    ],
  },
  {
    title: 'Testnets',
    data: [
      { label: 'Bitcoin Testnet', value: 'tbtc' },
      { label: 'Sepolia', value: 'sep' },
    ],
  },
];

// Select is controlled-only (no isUncontrolled escape hatch), so every story
// goes through this stateful wrapper. Pinning the generic to `string` keeps
// Storybook's arg inference concrete.
function ControlledSelect({
  value: initialValue = '',
  onChange,
  ...props
}: ISelectProps<string>) {
  const [value, setValue] = useState(initialValue);
  const handleChange = useCallback(
    (v: string) => {
      setValue(v);
      onChange?.(v);
    },
    [onChange],
  );
  return <Select {...props} value={value} onChange={handleChange} />;
}

const meta = {
  title: 'Forms/Select',
  component: ControlledSelect,
  args: {
    title: 'Select network',
    placeholder: 'Choose a network',
    items: NETWORK_ITEMS,
    value: '',
    disabled: false,
    onChange: fn(),
  },
  argTypes: {
    title: { control: 'text' },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof ControlledSelect>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Preselected: Story = {
  args: { value: 'eth' },
};

export const WithSections: Story = {
  args: { items: undefined, sections: NETWORK_SECTIONS },
};

export const Disabled: Story = {
  args: { value: 'btc', disabled: true },
};

const renderTextTrigger: NonNullable<ISelectProps<string>['renderTrigger']> = ({
  label,
  placeholder,
}) => (
  <SizableText color="$textInteractive">{label || placeholder}</SizableText>
);

export const CustomTrigger: Story = {
  render: (args) => (
    <ControlledSelect {...args} renderTrigger={renderTextTrigger} />
  ),
};
