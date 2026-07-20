import { QRCode } from '@onekeyhq/components/src/content/QRCode';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// QRCode always renders inside Theme name="light" so codes stay scannable in
// dark mode. The `animated` drawType (air-gap UR frames) needs a valueUr from
// @onekeyhq/qr-wallet-sdk — out of scope here; see SecureQRToast in kit.
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
    drawType: { control: 'select', options: ['line', 'dot'] },
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

export const DotStyle: Story = {
  args: {
    drawType: 'dot',
    logoSvg: 'OnekeyBrand',
  },
};
