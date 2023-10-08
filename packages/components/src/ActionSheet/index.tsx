import type { FC } from 'react';

import { Adapt, Button, ListItem, Popover, XStack, YStack } from 'tamagui';

import { Icon } from '../Icon';

import type { ICON_NAMES } from '../Icon';
import type { PopoverProps } from 'tamagui';

type Action = {
  icon?: ICON_NAMES;
  name: string;
  onPress?: () => void;
};

type ActionSheetProps = PopoverProps & {
  actions: Action[];
};

export const ActionSheet: FC<ActionSheetProps> = ({ actions, ...props }) => (
  <Popover size="$5" allowFlip placement="top" {...props}>
    <Popover.Trigger>
      <ListItem hoverTheme title="action sheet trigger" bordered />
    </Popover.Trigger>
    <Popover.Content
      borderWidth={1}
      backgroundColor="$red10"
      borderColor="$borderColor"
      enterStyle={{ y: -10, opacity: 0 }}
      exitStyle={{ y: -10, opacity: 0 }}
      elevate
      animation={[
        'quick',
        {
          opacity: {
            overshootClamping: true,
          },
        },
      ]}
    >
      <YStack space="$3">
        {actions.map((item) => (
          <Popover.Close onPress={item.onPress}>
            <ListItem hoverTheme icon={<Icon name={item.icon} size="$5" />}>
              {item.name}
            </ListItem>
          </Popover.Close>
        ))}
      </YStack>
    </Popover.Content>
    <Popover.Adapt when="md">
      <Popover.Sheet modal>
        <Popover.Sheet.Overlay
          animation="lazy"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Popover.Sheet.Frame padding="$4" backgroundColor="$red10">
          <Popover.Adapt.Contents />
        </Popover.Sheet.Frame>
      </Popover.Sheet>
    </Popover.Adapt>
  </Popover>
);
