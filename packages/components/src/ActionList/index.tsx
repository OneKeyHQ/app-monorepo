import { useCallback, useEffect, useState } from 'react';

import { withStaticProperties } from 'tamagui';

import { ButtonFrame } from '../Button';
import { Divider } from '../Divider';
import { Icon } from '../Icon';
import { Popover } from '../Popover';
import { Portal } from '../Portal';
import { YStack } from '../Stack';
import { Text } from '../Text';
import { Trigger } from '../Trigger';

import type { IKeyOfIcons } from '../Icon';
import type { IPopoverProps } from '../Popover';

interface IActionListItemProps {
  icon?: IKeyOfIcons;
  label: string;
  destructive?: boolean;
  onPress?: () => void | Promise<boolean | void>;
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

export interface IActionListProps
  extends Omit<IPopoverProps, 'renderContent' | 'open' | 'onOpenChange'> {
  items?: IActionListItemProps[];
  sections?: IActionListSection[];
  onOpenChange?: (isOpen: boolean) => void;
  defaultOpen?: boolean;
}

function BasicActionList({
  items,
  sections,
  renderTrigger,
  onOpenChange,
  defaultOpen = false,
  ...props
}: IActionListProps) {
  const [isOpen, setOpenStatus] = useState(false);
  const handleOpenStatusChange = useCallback(
    (openStatus: boolean) => {
      setOpenStatus(openStatus);
      onOpenChange?.(openStatus);
    },
    [onOpenChange],
  );
  // Fix the crash on Android where the view node cannot be found.
  useEffect(() => {
    if (defaultOpen) {
      setTimeout(() => {
        setOpenStatus(defaultOpen);
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleActionListOpen = useCallback(() => {
    handleOpenStatusChange(true);
  }, [handleOpenStatusChange]);
  const handleActionListClose = useCallback(() => {
    handleOpenStatusChange(false);
  }, [handleOpenStatusChange]);

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
      onOpenChange={handleOpenStatusChange}
      onFocusOutside={handleActionListClose}
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

export const ActionList = withStaticProperties(BasicActionList, {
  show: (props: Omit<IActionListProps, 'renderTrigger' | 'defaultOpen'>) => {
    Portal.Render(
      Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
      <BasicActionList {...props} defaultOpen renderTrigger={null} />,
    );
  },
});
