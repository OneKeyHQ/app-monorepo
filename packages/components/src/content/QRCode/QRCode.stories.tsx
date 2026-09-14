import { QRCode } from '@onekeyhq/components/src/content/QRCode';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// QRCode always renders inside Theme name="light" so codes stay scannable in
// dark mode. Passing a valueUr instead of a value makes the code animate
// through air-gap UR frames — that needs @onekeyhq/qr-wallet-sdk and is out of
// scope here; see SecureQRToast in kit.
const meta = {
  title: 'Content/QRCode',
  component: QRCode,
  args: {
    value: 'https://onekey.so',
    size: 200,
  },
  argTypes: {
    value: { control: 'text' },
    size: { control: 'number' },
    drawType: { control: 'select', options: ['dot', 'line'] },
  },
} satisfies Meta<typeof QRCode>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

// NOTE (verified 2026-07-12): the logoSvg VALUE is ignored — BasicQRCode
// hardcodes <Icon name="OnekeyBrand" />, so the prop is effectively an on/off
// switch today. Only the Gallery ever passed it (always 'OnekeyBrand').
export const WithLogo: Story = {
  args: {
    logoSvg: 'OnekeyBrand',
  },
};

// 'line' is the pre-OK-59643 style. Static codes stay dot, but air-gap UR
// codes default back to line because some hardware scanners cannot reliably
// decode dots.
export const LineStyle: Story = {
  args: {
    drawType: 'line',
    logoSvg: 'OnekeyBrand',
  },
};
