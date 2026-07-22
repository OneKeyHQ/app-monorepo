import { fn } from 'storybook/test';

import {
  ColorPicker,
  ColorPickerPalette,
} from '@onekeyhq/components/src/forms/ColorPicker';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const CUSTOM_COLORS = [
  '#E5484D',
  '#FBA43A',
  '#6AAF63',
  '#3D63DD',
  '#953EA8',
  { value: '#0F1013', label: 'Ink (disabled)', disabled: true },
] as const;

// ColorPicker = swatch trigger + overlay around ColorPickerPalette. It follows
// the responsive overlay convention: Popover on gtMd, dialog on md — the same
// portal contract the preview decorator already provides for Dialog stories.
const meta = {
  title: 'Forms/ColorPicker',
  component: ColorPicker,
  args: {
    defaultValue: '#3D63DD',
    onChange: fn(),
    closeOnSelect: true,
  },
  argTypes: {
    disabled: { control: 'boolean' },
    closeOnSelect: { control: 'boolean' },
  },
} satisfies Meta<typeof ColorPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

// The bare palette without trigger/overlay — all 77 default swatches.
export const InlinePalette: Story = {
  render: (args) => (
    <ColorPickerPalette
      defaultValue={args.defaultValue}
      onChange={args.onChange}
    />
  ),
};

// Options may be plain hex strings or { value, label, disabled } objects.
export const CustomColors: Story = {
  render: (args) => (
    <ColorPickerPalette
      colors={CUSTOM_COLORS}
      columns={6}
      swatchSize={36}
      defaultValue={args.defaultValue}
      onChange={args.onChange}
    />
  ),
};
