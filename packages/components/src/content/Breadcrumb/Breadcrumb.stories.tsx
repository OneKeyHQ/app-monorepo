import { fn } from 'storybook/test';

import { Breadcrumb } from '@onekeyhq/components/src/content/Breadcrumb';
import type { IBreadcrumbItem } from '@onekeyhq/components/src/content/Breadcrumb';
import { YStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const handleCrumbClick = fn();

// The last item is the current page, so it gets no onClick and renders
// non-interactive (the component disables items without onClick/href).
const ITEMS: IBreadcrumbItem[] = [
  { label: 'Wallet', onClick: handleCrumbClick },
  { label: 'Ethereum', onClick: handleCrumbClick },
  { label: 'Account #1', onClick: handleCrumbClick },
  { label: 'Transaction details' },
];

const DEEP_ITEMS: IBreadcrumbItem[] = [
  { label: 'Wallet', onClick: handleCrumbClick },
  { label: 'Ethereum', onClick: handleCrumbClick },
  { label: 'Account #1', onClick: handleCrumbClick },
  { label: 'DeFi', onClick: handleCrumbClick },
  { label: 'Lido', onClick: handleCrumbClick },
  { label: 'Position' },
];

const meta = {
  title: 'Content/Breadcrumb',
  component: Breadcrumb,
  args: {
    items: ITEMS,
    breadcrumbSize: 'md',
  },
  argTypes: {
    breadcrumbSize: { control: 'select', options: ['sm', 'md', 'lg'] },
    separator: { control: 'text' },
  },
} satisfies Meta<typeof Breadcrumb>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <YStack gap="$4" alignItems="flex-start">
      <Breadcrumb {...args} breadcrumbSize="sm" />
      <Breadcrumb {...args} breadcrumbSize="md" />
      <Breadcrumb {...args} breadcrumbSize="lg" />
    </YStack>
  ),
};

// maxItems keeps the first crumb, collapses the middle into "...", and shows
// the trailing (maxItems - 2) crumbs.
export const Collapsed: Story = {
  args: {
    items: DEEP_ITEMS,
    maxItems: 4,
  },
};

export const TextSeparator: Story = {
  args: {
    separator: '/',
  },
};
