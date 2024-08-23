import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { type GestureResponderEvent } from 'react-native';
import { useMedia, withStaticProperties } from 'tamagui';
import { useDebouncedCallback } from 'use-debounce';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

export interface IActionListItemProps {
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
      borderCurve="continuous"
      opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      aria-disabled={disabled}
      {...(!disabled && {
        hoverStyle: { bg: '$bgHover' },
        pressStyle: { bg: '$bgActive' },
        // focusable: true,
        // focusVisibleStyle: {
        //   outlineColor: '$focusRing',
        //   outlineStyle: 'solid',
        //   outlineWidth: 2,
        // },
      })}
      onPress={handlePress}
      testID={testID}
    >
      {icon ? (
        <Icon
          name={icon}
          size="$5"
          mr="$3"
          $md={{ size: '$6' }}
          color={destructive ? '$iconCritical' : '$icon'}
          {...iconProps}
        />
      ) : null}
      <SizableText
        textAlign="left"
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
  renderItems?: (params: {
    // TODO use cloneElement to override onClose props
    handleActionListClose: () => void;
    handleActionListOpen: () => void;
  }) => React.ReactNode | Promise<React.ReactNode>;
}

const useDefaultOpen = (defaultOpen: boolean) => {
  const [isOpen, setOpenStatus] = useState(
    platformEnv.isNativeAndroid ? false : defaultOpen,
  );
  // Fix the crash on Android where the view node cannot be found.
  useEffect(() => {
    if (platformEnv.isNativeAndroid) {
      if (defaultOpen) {
        setTimeout(() => {
          setOpenStatus(defaultOpen);
        }, 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [isOpen, setOpenStatus] as [
    boolean,
    Dispatch<SetStateAction<boolean>>,
  ];
};

function BasicActionList({
  items,
  sections,
  renderTrigger,
  onOpenChange,
  disabled,
  defaultOpen = false,
  renderItems,
  ...props
}: IActionListProps) {
  const [isOpen, setOpenStatus] = useDefaultOpen(defaultOpen);
  const [asyncItems, setAsyncItems] = useState<ReactNode>(null);

  const handleOpenStatusChange = useCallback(
    (openStatus: boolean) => {
      setOpenStatus(openStatus);
      onOpenChange?.(openStatus);
    },
    [onOpenChange, setOpenStatus],
  );
  const handleActionListOpen = useCallback(() => {
    handleOpenStatusChange(true);
  }, [handleOpenStatusChange]);
  const handleActionListClose = useCallback(() => {
    handleOpenStatusChange(false);
  }, [handleOpenStatusChange]);

  useEffect(() => {
    if (renderItems && isOpen) {
      void (async () => {
        const asyncItemsToRender = await renderItems({
          handleActionListClose,
          handleActionListOpen,
        });
        setAsyncItems(asyncItemsToRender);
      })();
    }
  }, [handleActionListClose, handleActionListOpen, isOpen, renderItems]);

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
              {sectionIdx > 0 ? <Divider mx="$2" my="$1" /> : null}
              {section.title ? (
                <Heading
                  size="$headingXs"
                  $md={{ size: '$headingSm', paddingVertical: '$2.5' }}
                  py="$1.5"
                  px="$2"
                  color="$textSubdued"
                >
                  {section.title}
                </Heading>
              ) : null}
              {section.items.map(renderActionListItem)}
            </YStack>
          ))}
          {asyncItems}
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

const showActionList = (
  props: Omit<IActionListProps, 'renderTrigger' | 'defaultOpen'> & {
    onClose?: () => void;
  },
) => {
  const ref = Portal.Render(
    Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
    <BasicActionList
      {...props}
      defaultOpen
      renderTrigger={null}
      onOpenChange={(isOpen) => {
        props.onOpenChange?.(isOpen);
        if (!isOpen) {
          setTimeout(() => {
            props.onClose?.();
          });
          // delay the destruction of the reference to allow for the completion of the animation transition.
          setTimeout(() => {
            ref.destroy();
          }, 500);
        }
      }}
    />,
  );
};

function ActionListFrame(props: IActionListProps) {
  const { gtMd } = useMedia();
  const { disabled, renderTrigger, ...popoverProps } = props;
  const handleActionListOpen = useDebouncedCallback(() => {
    showActionList(popoverProps);
  }, 250);

  if (gtMd) {
    return <BasicActionList {...props} />;
  }
  return (
    <Trigger onPress={handleActionListOpen} disabled={disabled}>
      {renderTrigger}
    </Trigger>
  );
}

export const ActionList = withStaticProperties(ActionListFrame, {
  show: showActionList,
  Item: ActionListItem,
});
