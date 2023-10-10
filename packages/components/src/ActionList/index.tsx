import type { FC } from 'react';

import { ListItem, Popover, YStack } from 'tamagui';

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
  renderTrigger: () => JSX.Element;
};

export const ActionList: FC<ActionSheetProps> = ({
  actions,
  renderTrigger,
  ...props
}) => (
  <Popover size="$5" allowFlip placement="top" {...props}>
    <Popover.Trigger>{renderTrigger()}</Popover.Trigger>
    <Popover.Content
      borderWidth={1}
      backgroundColor="$background"
      borderColor="$borderColor"
      enterStyle={{ opacity: 0 }}
      exitStyle={{ opacity: 1 }}
      elevate
      margin="$2"
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
        <Popover.Sheet.Frame padding="$4" backgroundColor="$bgActive">
          <Popover.Adapt.Contents />
        </Popover.Sheet.Frame>
      </Popover.Sheet>
    </Popover.Adapt>
  </Popover>
);
