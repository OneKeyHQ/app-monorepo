import { Divider } from '../Divider';
import { Icon } from '../Icon';
import { Popover } from '../Popover';
import { XStack, YStack } from '../Stack';
import { Text } from '../Text';

import type { ICON_NAMES } from '../Icon';
import type { PopoverProps } from '../Popover';

interface ActionListItemProps {
  icon?: ICON_NAMES;
  label: string;
  destructive?: boolean;
  onPress?: () => void;
}

function ActionListItem({
  icon,
  label,
  onPress,
  destructive,
}: ActionListItemProps) {
  return (
    <XStack
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      borderRadius="$2"
      px="$2"
      py="$1.5"
      $md={{
        py: '$2.5',
        borderRadius: '$3',
      }}
      space="$3"
      alignItems="center"
    >
      {icon && (
        <Icon
          name={icon}
          size="$5"
          $md={{ size: '$6' }}
          color={destructive ? '$iconCritical' : '$icon'}
        />
      )}
      <Text
        variant="$bodyMd"
        $md={{ variant: '$bodyLg' }}
        userSelect="none"
        color={destructive ? '$textCritical' : '$text'}
      >
        {label}
      </Text>
    </XStack>
  );
}

interface ActionListSection {
  title?: string;
  items: ActionListItemProps[];
}

export interface ActionListProps extends PopoverProps {
  items?: ActionListItemProps[];
  sections?: ActionListSection[];
}

export function ActionList({
  items,
  sections,
  ...props
}: Omit<ActionListProps, 'renderContent'>) {
  return (
    <Popover
      renderContent={
        <YStack p="$1" $md={{ p: '$3' }}>
          {items?.map((item) => (
            <Popover.Close onPress={item.onPress} key={item.label}>
              <ActionListItem
                icon={item.icon}
                label={item.label}
                destructive={item.destructive}
              />
            </Popover.Close>
          ))}

          {sections?.map((section, sectionIdx) => (
            <YStack key={sectionIdx}>
              {sectionIdx > 0 && <Divider mx="$2" my="$1" />}
              {section.title && (
                <Text
                  variant="$headingXs"
                  $md={{ variant: '$headingSm', paddingVertical: '$2.5' }}
                  paddingVertical="$1.5"
                  paddingHorizontal="$2"
                  color="$textSubdued"
                >
                  {section.title}
                </Text>
              )}
              {section.items.map((item) => (
                <Popover.Close onPress={item.onPress} key={item.label}>
                  <ActionListItem
                    icon={item.icon}
                    label={item.label}
                    destructive={item.destructive}
                  />
                </Popover.Close>
              ))}
            </YStack>
          ))}
        </YStack>
      }
      floatingPanelProps={{
        width: '$56',
      }}
      {...props}
    />
  );
}
