import { NumberSizeableText } from '@onekeyhq/components/src/content/NumberSizeableText';
import { SizableText } from '@onekeyhq/components/src/primitives/SizeableText';
import { XStack, YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const FORMATTERS = [
  'balance',
  'price',
  'priceChange',
  'priceChangeCapped',
  'value',
  'marketCap',
  'antonym',
] as const;

const BTC_OPTIONS = { tokenSymbol: 'BTC' } as const;
const USD_OPTIONS = { currency: '$' } as const;
const SIGNED_OPTIONS = { showPlusMinusSigns: true } as const;

const meta = {
  title: 'Content/NumberSizeableText',
  component: NumberSizeableText,
  args: {
    // Small balance exercises the leading-zero subscript rendering (0.0₈431)
    children: '0.0000000431',
    formatter: 'balance',
    formatterOptions: { tokenSymbol: 'BTC' },
    size: '$bodyLgMedium',
  },
  argTypes: {
    children: { control: 'text' },
    formatter: { control: 'select', options: FORMATTERS },
    hideValue: { control: 'boolean' },
  },
} satisfies Meta<typeof NumberSizeableText>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

function FormatterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <XStack gap="$4" alignItems="center" justifyContent="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      {children}
    </XStack>
  );
}

export const Formatters: Story = {
  render: () => (
    <YStack gap="$3" maxWidth={360}>
      <FormatterRow label="balance">
        <NumberSizeableText formatter="balance" formatterOptions={BTC_OPTIONS}>
          0.0000000431
        </NumberSizeableText>
      </FormatterRow>
      <FormatterRow label="price">
        <NumberSizeableText formatter="price" formatterOptions={USD_OPTIONS}>
          63241.52
        </NumberSizeableText>
      </FormatterRow>
      <FormatterRow label="priceChange">
        <NumberSizeableText
          formatter="priceChange"
          formatterOptions={SIGNED_OPTIONS}
          color="$textSuccess"
        >
          5.24
        </NumberSizeableText>
      </FormatterRow>
      <FormatterRow label="marketCap">
        <NumberSizeableText
          formatter="marketCap"
          formatterOptions={USD_OPTIONS}
        >
          1240000000
        </NumberSizeableText>
      </FormatterRow>
      <FormatterRow label="splitDecimal">
        <NumberSizeableText
          formatter="price"
          formatterOptions={USD_OPTIONS}
          splitDecimal
        >
          1234.5678
        </NumberSizeableText>
      </FormatterRow>
    </YStack>
  ),
};

// hideValue is the app-wide "hide balances" eye toggle: balance + tokenSymbol
// keeps the symbol (**** BTC), everything else collapses to ****.
export const HideValue: Story = {
  args: {
    hideValue: true,
  },
};
