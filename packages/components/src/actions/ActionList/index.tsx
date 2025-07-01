import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';
import { type GestureResponderEvent } from 'react-native';
import { useMedia, withStaticProperties } from 'tamagui';
import { useDebouncedCallback } from 'use-debounce';

import { Spinner } from '@onekeyhq/components/src/primitives/Spinner';
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
import { ModalNavigatorContext, useModalNavigatorContext } from '../../hooks';
import { PageContext, usePageContext } from '../../layouts/Page/PageContext';
import {
  ButtonFrame,
  Heading,
  Icon,
  SizableText,
  Skeleton,
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
  extra?: ReactNode;
  description?: string;
  destructive?: boolean;
  onPress?: (close: () => void) => void | Promise<boolean | void>;
  onClose?: () => void;
  disabled?: boolean;
  testID?: string;
  trackID?: string;
  shortcutKeys?: string[] | EShortcutEvents;
  isLoading?: boolean;
}

// Duration to prevent rapid re-triggering of the action list
const PROCESSING_RESET_DELAY = 350;

export function ActionListSkeletonItem() {
  return (
    <XStack
      flex={1}
      mx="$2"
      height="$8"
      position="relative"
      borderRadius="$2"
      overflow="hidden"
    >
      <Skeleton height="100%" width="100%" />
    </XStack>
  );
}

export function ActionListItem(
  props: IActionListItemProps & {
    onClose: () => void;
  },
) {
  const {
    icon,
    iconProps,
    label,
    extra,
    description,
    onPress,
    destructive,
    disabled,
    onClose,
    testID,
    shortcutKeys,
    isLoading,
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
      onPress={isLoading ? undefined : sharedOnPress}
      testID={testID}
    >
      <XStack jc="space-between" flex={1} alignItems="center">
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
        {isLoading ? <Spinner size="small" /> : extra}
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
      void (async () => {
        const asyncItemsToRender = await renderItemsAsync({
          handleActionListClose,
          handleActionListOpen,
        });
        setAsyncItems(asyncItemsToRender);
      })();
    }
  }, [
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
      onClose={() => {
        handleActionListClose();
        item.onClose?.();
      }}
    />
  );

  const trigger = useMemo(() => {
    return (
      <Trigger onPress={handleActionListOpen} disabled={disabled}>
        {renderTrigger}
      </Trigger>
    );
  }, [disabled, renderTrigger, handleActionListOpen]);

  if (renderItemsAsync && !asyncItems) {
    return trigger;
  }
  return (
    <Popover
      title={title || intl.formatMessage({ id: ETranslations.explore_options })}
      open={isOpen}
      onOpenChange={handleOpenStatusChange}
      renderContent={
        <YStack p="$1" $md={{ p: '$3', pt: '$0' }}>
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

          {/* custom async render items */}
          {asyncItems}
        </YStack>
      }
      floatingPanelProps={{
        width: '$56',
      }}
      {...props}
      renderTrigger={trigger}
    />
  );
}

type IShowActionListParams = Omit<
  IActionListProps,
  'renderTrigger' | 'defaultOpen'
> & {
  onClose?: () => void;
};
const showActionList = (
  props: IShowActionListParams,
  contexts:
    | {
        modalNavigatorContext: ReturnType<typeof useModalNavigatorContext>;
        pageContextValue?: ReturnType<typeof usePageContext>;
      }
    | undefined,
) => {
  const { modalNavigatorContext, pageContextValue } = contexts || {};
  dismissKeyboard();
  const ref = Portal.Render(
    Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
    <ModalNavigatorContext.Provider
      value={modalNavigatorContext || { portalId: '' }}
    >
      <PageContext.Provider
        value={pageContextValue || { footerRef: { current: null } as any }}
      >
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
        />
      </PageContext.Provider>
    </ModalNavigatorContext.Provider>,
  );
};
const debouncedShowActionList = debounce(
  showActionList,
  PROCESSING_RESET_DELAY,
);

function ActionListFrame(props: IActionListProps) {
  const isProcessing = useRef(false);

  const { gtMd } = useMedia();
  const { disabled, renderTrigger, ...popoverProps } = props;

  const modalNavigatorContext = useModalNavigatorContext();
  const pageContextValue = usePageContext();
  const contexts = {
    modalNavigatorContext,
    pageContextValue,
  };
  const handleActionListOpen = () => {
    if (isProcessing.current) return;

    isProcessing.current = true;
    showActionList(popoverProps, contexts);
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

const show = (props: IShowActionListParams) =>
  debouncedShowActionList(props, undefined);

export const ActionList = withStaticProperties(ActionListFrame, {
  show,
  Item: ActionListItem,
  SkeletonItem: ActionListSkeletonItem,
});
