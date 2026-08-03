import { UnOrderedList } from '@onekeyhq/components/src/layouts/UnorderedList';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

const SUCCESS_ICON_PROPS = { color: '$iconSuccess' } as const;
const CRITICAL_ICON_PROPS = { color: '$iconCritical' } as const;

// Note the export casing: UnOrderedList / UnOrderedList.Item. Items default
// to a bullet dot; `icon` swaps it, `description` adds a subdued second line.
const meta = {
  title: 'Layouts/UnorderedList',
  component: UnOrderedList,
} satisfies Meta<typeof UnOrderedList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: () => (
    <UnOrderedList maxWidth={360}>
      <UnOrderedList.Item>Write the phrase on paper</UnOrderedList.Item>
      <UnOrderedList.Item>Store it somewhere private</UnOrderedList.Item>
      <UnOrderedList.Item>Never share it with anyone</UnOrderedList.Item>
    </UnOrderedList>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <UnOrderedList maxWidth={360}>
      <UnOrderedList.Item
        icon="Shield2CheckOutline"
        iconProps={SUCCESS_ICON_PROPS}
        description="Your recovery phrase never leaves this device."
      >
        Stored offline
      </UnOrderedList.Item>
      <UnOrderedList.Item
        icon="LockOutline"
        iconProps={SUCCESS_ICON_PROPS}
        description="A passcode is required before every export."
      >
        Passcode protected
      </UnOrderedList.Item>
      <UnOrderedList.Item
        icon="EyeOffOutline"
        iconProps={CRITICAL_ICON_PROPS}
        description="OneKey support will never ask for your phrase."
      >
        Beware of phishing
      </UnOrderedList.Item>
    </UnOrderedList>
  ),
};
