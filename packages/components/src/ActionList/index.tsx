import { ButtonFrame } from '../Button';
import { Divider } from '../Divider';
import { Icon } from '../Icon';
import { Popover } from '../Popover';
import { YStack } from '../Stack';
import { Text } from '../Text';

import type { ICON_NAMES } from '../Icon';
import type { PopoverProps } from '../Popover';

interface ActionListItemProps {
  icon?: ICON_NAMES;
  label: string;
  destructive?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

function ActionListItem({
  icon,
  label,
  onPress,
  destructive,
  disabled,
}: ActionListItemProps) {
  return (
    <ButtonFrame
      justifyContent="flex-start"
      bg="$bg"
      px="$2"
      py="$1.5"
      borderWidth={0}
      borderRadius="$2"
      $md={{
        py: '$2.5',
        borderRadius: '$3',
      }}
      opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      {...(!disabled && {
        mb: 2,
        hoverStyle: { bg: '$bgHover' },
        pressStyle: { bg: '$bgActive' },
        focusable: true,
        focusStyle: {
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
        },
      })}
      onPress={onPress}
    >
      {icon && (
        <Icon
          name={icon}
          size="$5"
          mr="$3"
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
    </ButtonFrame>
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
  const renderActionListItem = (item: ActionListItemProps) => (
    <ActionListItem
      onPress={item.onPress}
      key={item.label}
      disabled={item.disabled}
      {...item}
    />
  );

  return (
    <Popover
      renderContent={
        <YStack p="$1" $md={{ p: '$3' }}>
          {items?.map(renderActionListItem)}

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
              {section.items.map(renderActionListItem)}
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
