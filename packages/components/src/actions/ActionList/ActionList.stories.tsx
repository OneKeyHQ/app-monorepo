import { useCallback } from 'react';

import { fn } from 'storybook/test';

import { ActionList } from '@onekeyhq/components/src/actions/ActionList';
import type { IActionListProps } from '@onekeyhq/components/src/actions/ActionList';
import { Button } from '@onekeyhq/components/src/primitives/Button';
import { XStack } from '@onekeyhq/components/src/primitives/Stack';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import type { GestureResponderEvent } from 'react-native';

const ACCOUNT_ITEMS: IActionListProps['items'] = [
  { label: 'Rename', icon: 'PencilOutline', onPress: fn() },
  { label: 'Copy address', icon: 'Copy3Outline', onPress: fn() },
  { label: 'View in explorer', icon: 'GlobusOutline', onPress: fn() },
  {
    label: 'Export private key',
    icon: 'KeyOutline',
    disabled: true,
    onPress: fn(),
  },
  {
    label: 'Remove account',
    icon: 'DeleteOutline',
    destructive: true,
    onPress: fn(),
  },
];

const MANAGE_SECTIONS: IActionListProps['sections'] = [
  {
    title: 'Account',
    items: [
      { label: 'Rename', icon: 'PencilOutline', onPress: fn() },
      { label: 'Copy address', icon: 'Copy3Outline', onPress: fn() },
    ],
  },
  {
    title: 'Danger zone',
    items: [
      {
        label: 'Remove account',
        icon: 'DeleteOutline',
        destructive: true,
        onPress: fn(),
      },
    ],
  },
];

type IContextMenuTriggerProps = Omit<
  IActionListProps,
  'renderTrigger' | 'defaultOpen'
> & {
  label: string;
};

// ActionList.show is the imperative entry the app uses for context menus
// (right-click / long-press): no trigger element, positioned at the pointer
// on web/desktop. Native ignores triggerPosition and opens the sheet.
function ContextMenuTrigger({ label, ...listProps }: IContextMenuTriggerProps) {
  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      ActionList.show({
        ...listProps,
        triggerPosition: {
          x: e.nativeEvent?.pageX ?? 160,
          y: e.nativeEvent?.pageY ?? 160,
        },
      });
    },
    [listProps],
  );
  return (
    <Button alignSelf="flex-start" onPress={handlePress}>
      {label}
    </Button>
  );
}

const meta = {
  title: 'Actions/ActionList',
  component: ActionList,
  args: {
    title: 'Account options',
    renderTrigger: <Button alignSelf="flex-start">Account options</Button>,
    items: ACCOUNT_ITEMS,
    onOpenChange: fn(),
  },
  argTypes: {
    title: { control: 'text' },
  },
  decorators: [
    // In the preview's full-width column, ActionList's internal Trigger
    // wrapper stretches to the row and the gtMd floating panel anchors to
    // that full-width box (pinned to the right edge) instead of the button.
    // App layouts always put the trigger in a content-sized container; a row
    // wrapper restores that so floating-ui anchors to the visible trigger.
    (Story) => (
      <XStack>
        <Story />
      </XStack>
    ),
  ],
} satisfies Meta<typeof ActionList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const WithSections: Story = {
  args: { items: undefined, sections: MANAGE_SECTIONS },
};

export const ImperativeShow: Story = {
  render: (args) => <ContextMenuTrigger {...args} label="ActionList.show()" />,
};
