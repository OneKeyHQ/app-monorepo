import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';
import { type GestureResponderEvent } from 'react-native';
import { useMedia, withStaticProperties } from 'tamagui';
import { useDebouncedCallback } from 'use-debounce';

import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type EShortcutEvents,
  shortcutsMap,
} from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { Divider } from '../../content';
import { Portal } from '../../hocs';
import {
  ButtonFrame,
  Heading,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '../../primitives';
import { useSharedPress } from '../../primitives/Button/useEvent';
import { Popover } from '../Popover';
import { Shortcut } from '../Shortcut';
import { Trigger } from '../Trigger';

import type { IIconProps, IKeyOfIcons } from '../../primitives';
import type { IPopoverProps } from '../Popover';

export interface IActionListItemProps {
  icon?: IKeyOfIcons;
  iconProps?: IIconProps;
  label: string;
  description?: string;
  destructive?: boolean;
  onPress?: (close: () => void) => void | Promise<boolean | void>;
  disabled?: boolean;
  testID?: string;
  trackID?: string;
  shortcutKeys?: string[] | EShortcutEvents;
}

// Duration to prevent rapid re-triggering of the action list
const PROCESSING_RESET_DELAY = 350;

export function ActionListItem(
  props: IActionListItemProps & {
    onClose: () => void;
  },
) {
  const {
    icon,
    iconProps,
    label,
    description,
    onPress,
    destructive,
    disabled,
    onClose,
    testID,
    shortcutKeys,
  } = props;

  const handlePress = useCallback(
    async (event: GestureResponderEvent) => {
      event.stopPropagation();
      await onPress?.(onClose);
      if (!onPress?.length) {
        onClose?.();
      }
    },
    [onClose, onPress],
  );

  const keys = useMemo(() => {
    if (shortcutKeys) {
      if (Array.isArray(shortcutKeys)) {
        return shortcutKeys;
      }
      return shortcutsMap[shortcutKeys].keys;
    }
    return undefined;
  }, [shortcutKeys]);

  const { onPress: sharedOnPress } = useSharedPress({
    ...props,
    onPress: handlePress,
  });

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
      onPress={sharedOnPress}
      testID={testID}
    >
      <XStack jc="space-between" flex={1}>
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
        <YStack gap="$0.5" flex={1}>
          <XStack>
            <SizableText
              flex={1}
              textAlign="left"
              size="$bodyMd"
              width="100%"
              flexShrink={1}
              $md={{ size: '$bodyLg' }}
              color={destructive ? '$textCritical' : '$text'}
            >
              {label}
            </SizableText>

            {(platformEnv.isDesktop || platformEnv.isNativeIOSPad) &&
            keys?.length ? (
              <Shortcut>
                {keys.map((key) => (
                  <Shortcut.Key key={key}>{key}</Shortcut.Key>
                ))}
              </Shortcut>
            ) : null}
          </XStack>
          {description ? (
            <SizableText size="$bodyMd" color="$textSubdued" textAlign="left">
              {description}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
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
  }) => React.ReactNode;
  // estimatedContentHeight required if use renderItemsAsync
  estimatedContentHeight?: number;
  renderItemsAsync?: (params: {
    // TODO use cloneElement to override onClose props
    handleActionListClose: () => void;
    handleActionListOpen: () => void;
  }) => Promise<React.ReactNode>;
  /**
   * Unique identifier for tracking/analytics purposes.
   */
  trackID?: string;
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
  renderItemsAsync,
  estimatedContentHeight,
  title,
  trackID,
  ...props
}: IActionListProps) {
  const [isOpen, setOpenStatus] = useDefaultOpen(defaultOpen);
  const [asyncItems, setAsyncItems] = useState<ReactNode>(null);
  const trackActionListToggle = useDebouncedCallback((openStatus: boolean) => {
    if (trackID) {
      if (openStatus) {
        defaultLogger.ui.actionList.actionListOpen({
          trackId: trackID,
        });
      } else {
        defaultLogger.ui.actionList.actionListClose({
          trackId: trackID,
        });
      }
    }
  }, 500);

  const handleOpenStatusChange = useCallback(
    (openStatus: boolean) => {
      setOpenStatus(openStatus);
      onOpenChange?.(openStatus);
      trackActionListToggle(openStatus);
    },
    [onOpenChange, setOpenStatus, trackActionListToggle],
  );
  const handleActionListOpen = useCallback(() => {
    handleOpenStatusChange(true);
  }, [handleOpenStatusChange]);
  const handleActionListClose = useCallback(() => {
    handleOpenStatusChange(false);
  }, [handleOpenStatusChange]);

  const { md } = useMedia();
  const intl = useIntl();
  useEffect(() => {
    if (renderItemsAsync && isOpen) {
      if (platformEnv.isDev && md && !estimatedContentHeight) {
        throw new Error(
          'estimatedContentHeight is required on Async rendering items',
        );
      }
      void (async () => {
        const asyncItemsToRender = await renderItemsAsync({
          handleActionListClose,
          handleActionListOpen,
        });
        setAsyncItems(asyncItemsToRender);
      })();
    }
  }, [
    estimatedContentHeight,
    handleActionListClose,
    handleActionListOpen,
    isOpen,
    md,
    renderItemsAsync,
  ]);

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
      title={title || intl.formatMessage({ id: ETranslations.explore_options })}
      open={isOpen}
      onOpenChange={handleOpenStatusChange}
      renderContent={
        <YStack
          p="$1"
          $md={{ p: '$3', pt: '$0' }}
          height={estimatedContentHeight}
          onLayout={(e) => console.log(e.nativeEvent.layout.height)}
        >
          {items?.map(renderActionListItem)}

          {sections?.map((section, sectionIdx) => (
            <YStack key={sectionIdx}>
              {sectionIdx > 0 && section.items.length > 0 ? (
                <Divider mx="$2" my="$1" />
              ) : null}
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

          {/* custom render items */}
          {renderItems?.({
            handleActionListClose,
            handleActionListOpen,
          })}

          {/* custom async render items (estimatedContentHeight required) */}
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
  dismissKeyboard();
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
const debouncedShowActionList = debounce(
  showActionList,
  PROCESSING_RESET_DELAY,
);

function ActionListFrame({
  estimatedContentHeight,
  ...props
}: Omit<IActionListProps, 'estimatedContentHeight'> & {
  estimatedContentHeight?: () => Promise<number>;
}) {
  const isProcessing = useRef(false);

  const { gtMd } = useMedia();
  const { disabled, renderTrigger, ...popoverProps } = props;
  const handleActionListOpen = () => {
    if (isProcessing.current) return;

    isProcessing.current = true;
    if (estimatedContentHeight) {
      void estimatedContentHeight().then((height) => {
        showActionList({
          ...popoverProps,
          estimatedContentHeight: height,
        });
      });
    } else {
      showActionList(popoverProps);
    }

    setTimeout(() => {
      isProcessing.current = false;
    }, PROCESSING_RESET_DELAY);
  };

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
  show: debouncedShowActionList,
  Item: ActionListItem,
});
