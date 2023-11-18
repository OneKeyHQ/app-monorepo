import { useCallback, useState } from 'react';

import { ButtonFrame } from '../Button';
import { Divider } from '../Divider';
import { Icon } from '../Icon';
import { Popover } from '../Popover';
import { YStack } from '../Stack';
import { Text } from '../Text';
import { Trigger } from '../Trigger';

import type { IICON_NAMES } from '../Icon';
import type { IPopoverProps } from '../Popover';

interface IActionListItemProps {
  icon?: IICON_NAMES;
  label: string;
  destructive?: boolean;
  onPress?: () => void | Promise<boolean>;
  disabled?: boolean;
}

function ActionListItem({
  icon,
  label,
  onPress,
  destructive,
  disabled,
  onClose,
}: IActionListItemProps & {
  onClose?: () => void;
}) {
  const handlePress = useCallback(async () => {
    const result = await onPress?.();
    if (result || result === undefined) {
      onClose?.();
    }
  }, [onClose, onPress]);
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
      onPress={handlePress}
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

interface IActionListSection {
  title?: string;
  items: IActionListItemProps[];
}

export interface IActionListProps extends IPopoverProps {
  items?: IActionListItemProps[];
  sections?: IActionListSection[];
}

export function ActionList({
  items,
  sections,
  renderTrigger,
  ...props
}: Omit<IActionListProps, 'renderContent'>) {
  const [isOpen, setOpenStatus] = useState(false);
  const handleActionListOpen = useCallback(() => {
    setOpenStatus(true);
  }, []);
  const handleActionListClose = useCallback(() => {
    setOpenStatus(false);
  }, []);
  const renderActionListItem = (item: IActionListItemProps) => (
    <ActionListItem
      onPress={item.onPress}
      key={item.label}
      disabled={item.disabled}
      {...item}
      onClose={handleActionListClose}
    />
  );
  return (
    <Popover
      open={isOpen}
      onOpenChange={setOpenStatus}
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
      renderTrigger={
        <Trigger onOpen={handleActionListOpen}>{renderTrigger}</Trigger>
      }
    />
  );
}
