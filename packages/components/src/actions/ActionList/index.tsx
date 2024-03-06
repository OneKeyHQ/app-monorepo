import { useCallback, useEffect, useState } from 'react';

import { withStaticProperties } from 'tamagui';

import { Divider } from '../../content';
import { Portal } from '../../hocs';
import {
  ButtonFrame,
  Heading,
  Icon,
  SizableText,
  YStack,
} from '../../primitives';
import { Popover } from '../Popover';
import { Trigger } from '../Trigger';

import type { IIconProps, IKeyOfIcons } from '../../primitives';
import type { IPopoverProps } from '../Popover';
import type { GestureResponderEvent } from 'react-native';

interface IActionListItemProps {
  icon?: IKeyOfIcons;
  iconProps?: IIconProps;
  label: string;
  destructive?: boolean;
  onPress?: () => void | Promise<boolean | void>;
  disabled?: boolean;
  testID?: string;
}

export function ActionListItem({
  icon,
  iconProps,
  label,
  onPress,
  destructive,
  disabled,
  onClose,
  testID,
}: IActionListItemProps & {
  onClose?: () => void;
}) {
  const handlePress = useCallback(
    async (event: GestureResponderEvent) => {
      event.stopPropagation();
      const result = await onPress?.();
      if (result || result === undefined) {
        onClose?.();
      }
    },
    [onClose, onPress],
  );
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
      style={{
        borderCurve: 'continuous',
      }}
      opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      {...(!disabled && {
        hoverStyle: { bg: '$bgHover' },
        pressStyle: { bg: '$bgActive' },
        // focusable: true,
        // focusStyle: {
        //   outlineColor: '$focusRing',
        //   outlineStyle: 'solid',
        //   outlineWidth: 2,
        // },
      })}
      onPress={handlePress}
      testID={testID}
    >
      {icon && (
        <Icon
          name={icon}
          size="$5"
          mr="$3"
          $md={{ size: '$6' }}
          color={destructive ? '$iconCritical' : '$icon'}
          {...iconProps}
        />
      )}
      <SizableText
        size="$bodyMd"
        $md={{ size: '$bodyLg' }}
        color={destructive ? '$textCritical' : '$text'}
      >
        {label}
      </SizableText>
    </ButtonFrame>
  );
}

export interface IActionListSection {
  title?: string;
  items: IActionListItemProps[];
}

export interface IActionListProps
  extends Omit<IPopoverProps, 'renderContent' | 'open' | 'onOpenChange'> {
  items?: IActionListItemProps[];
  sections?: IActionListSection[];
  onOpenChange?: (isOpen: boolean) => void;
  disabled?: boolean;
  defaultOpen?: boolean;
}

function BasicActionList({
  items,
  sections,
  renderTrigger,
  onOpenChange,
  disabled,
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
      renderContent={
        <YStack p="$1" $md={{ p: '$3', pt: '$0' }}>
          {items?.map(renderActionListItem)}

          {sections?.map((section, sectionIdx) => (
            <YStack key={sectionIdx}>
              {sectionIdx > 0 && <Divider mx="$2" my="$1" />}
              {section.title && (
                <Heading
                  size="$headingXs"
                  $md={{ size: '$headingSm', paddingVertical: '$2.5' }}
                  py="$1.5"
                  px="$2"
                  color="$textSubdued"
                >
                  {section.title}
                </Heading>
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
        <Trigger onPress={handleActionListOpen} disabled={disabled}>
          {renderTrigger}
        </Trigger>
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
