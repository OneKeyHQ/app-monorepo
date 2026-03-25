import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';
import { Dimensions, type GestureResponderEvent } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import { useMedia } from '@onekeyhq/components/src/hooks/useStyle';
import { Spinner } from '@onekeyhq/components/src/primitives/Spinner';
import { withStaticProperties } from '@onekeyhq/components/src/shared/tamagui';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type EShortcutEvents,
  shortcutsMap,
} from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';

import { Divider } from '../../content/Divider';
import { Portal } from '../../hocs';
import { ModalNavigatorContext, useModalNavigatorContext } from '../../hooks';
import { PageContext, usePageContext } from '../../layouts/Page/PageContext';
import {
  ButtonFrame,
  Heading,
  Icon,
  SizableText,
  Skeleton,
  Stack,
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
  descriptionNumberOfLines?: number;
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
const FALLBACK_MODAL_NAVIGATOR_CONTEXT = { portalId: '' };
const FALLBACK_PAGE_CONTEXT = { footerRef: { current: null } as any };

const ACTION_LIST_ITEM_MD = { py: '$2.5', borderRadius: '$3' } as const;
const ACTION_LIST_ICON_MD = { size: '$6' } as const;
const ACTION_LIST_TEXT_MD = { size: '$bodyLg' } as const;
const ACTION_LIST_HOVER_STYLE = { bg: '$bgHover' } as const;
const ACTION_LIST_PRESS_STYLE = { bg: '$bgActive' } as const;
const ACTION_LIST_ENABLED_STYLE = {
  hoverStyle: ACTION_LIST_HOVER_STYLE,
  pressStyle: ACTION_LIST_PRESS_STYLE,
} as const;
const ACTION_LIST_CONTENT_STYLE = {
  p: '$1',
  $md: { p: '$3', pt: '$0' },
} as const;
const ACTION_LIST_FLOATING_PANEL_PROPS = { width: '$56' } as const;
const ACTION_LIST_MD_HEADING = {
  size: '$headingSm',
  paddingVertical: '$2.5',
} as const;

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
    descriptionNumberOfLines,
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
      $md={ACTION_LIST_ITEM_MD}
      borderCurve="continuous"
      opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      aria-disabled={disabled}
      {...(!disabled && ACTION_LIST_ENABLED_STYLE)}
      onPress={isLoading ? undefined : sharedOnPress}
      testID={testID}
    >
      <XStack jc="space-between" flex={1} alignItems="center">
        {icon ? (
          <Icon
            name={icon}
            size="$5"
            mr="$3"
            $md={ACTION_LIST_ICON_MD}
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
              $md={ACTION_LIST_TEXT_MD}
              color={destructive ? '$textCritical' : '$text'}
            >
              {label}
            </SizableText>

            {platformEnv.isDesktop && keys?.length ? (
              <Shortcut>
                {keys.map((key) => (
                  <Shortcut.Key key={key}>{key}</Shortcut.Key>
                ))}
              </Shortcut>
            ) : null}
          </XStack>
          {description ? (
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              textAlign="left"
              numberOfLines={descriptionNumberOfLines}
              ellipsizeMode={descriptionNumberOfLines ? 'tail' : undefined}
            >
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

export interface IActionListProps extends Omit<
  IPopoverProps,
  'renderContent' | 'open' | 'onOpenChange'
> {
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
      if (!openStatus) {
        setAsyncItems(null);
      }
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

  const renderActionListItem = useCallback(
    (item: IActionListItemProps) => (
      <ActionListItem
        onPress={item.onPress}
        key={item.label}
        disabled={item.disabled}
        {...item}
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
        onClose={() => {
          handleActionListClose();
          item.onClose?.();
        }}
      />
    ),
    [handleActionListClose],
  );

  const trigger = useMemo(() => {
    return (
      <Trigger onPress={handleActionListOpen} disabled={disabled}>
        {renderTrigger}
      </Trigger>
    );
  }, [disabled, renderTrigger, handleActionListOpen]);

  const renderContentMemo = useMemo(
    () => (
      <YStack {...ACTION_LIST_CONTENT_STYLE}>
        {items?.map(renderActionListItem)}
        {sections?.map((section, sectionIdx) => (
          <YStack key={sectionIdx}>
            {sectionIdx > 0 && section.items.length > 0 ? (
              <Divider mx="$2" my="$1" />
            ) : null}
            {section.title ? (
              <Heading
                size="$headingXs"
                $md={ACTION_LIST_MD_HEADING}
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

        {/* custom async render items - show skeleton while loading */}
        {renderItemsAsync && !asyncItems ? (
          <>
            <ActionListSkeletonItem />
            <ActionListSkeletonItem />
          </>
        ) : (
          asyncItems
        )}
      </YStack>
    ),
    [
      items,
      sections,
      renderActionListItem,
      renderItems,
      renderItemsAsync,
      asyncItems,
      handleActionListClose,
      handleActionListOpen,
    ],
  );

  return (
    <Popover
      title={title || intl.formatMessage({ id: ETranslations.explore_options })}
      open={isOpen}
      onOpenChange={handleOpenStatusChange}
      renderContent={renderContentMemo}
      floatingPanelProps={ACTION_LIST_FLOATING_PANEL_PROPS}
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
  triggerPosition?: { x: number; y: number };
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
  const { triggerPosition, ...restProps } = props;
  dismissKeyboard();

  // eslint-disable-next-line react-perf/jsx-no-jsx-as-prop
  const triggerElement =
    triggerPosition && !platformEnv.isNative ? (
      <Stack width={1} height={1} />
    ) : null;

  // Use let so the destroy callback can reference it after assignment
  // eslint-disable-next-line prefer-const
  let ref: { destroy: () => void };

  // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop
  const handleOpenChange = (isOpen: boolean) => {
    restProps.onOpenChange?.(isOpen);
    if (!isOpen) {
      setTimeout(() => {
        restProps.onClose?.();
      });
      // delay the destruction of the reference to allow for the completion of the animation transition.
      setTimeout(() => {
        ref.destroy();
      }, 500);
    }
  };

  // For context menu positioning: compute the optimal placement direction
  // based on viewport boundaries, like native OS context menus that flip
  // at screen edges. Keep allowFlip disabled to prevent Floating UI from
  // recalculating placement during close animation.
  let contextMenuPlacement:
    | 'bottom-start'
    | 'bottom-end'
    | 'top-start'
    | 'top-end' = 'bottom-start';
  if (triggerPosition && !platformEnv.isNative) {
    const { height: windowHeight, width: windowWidth } =
      Dimensions.get('window');
    const ESTIMATED_MENU_HEIGHT = 200;
    const ESTIMATED_MENU_WIDTH = 224; // $56 = 56 * 4 = 224px
    const EDGE_PADDING = 8;

    const spaceBelow = windowHeight - triggerPosition.y - EDGE_PADDING;
    const spaceRight = windowWidth - triggerPosition.x - EDGE_PADDING;

    const vertical = spaceBelow >= ESTIMATED_MENU_HEIGHT ? 'bottom' : 'top';
    const horizontal = spaceRight >= ESTIMATED_MENU_WIDTH ? 'start' : 'end';
    contextMenuPlacement =
      `${vertical}-${horizontal}` as typeof contextMenuPlacement;
  }

  const contextMenuProps =
    triggerPosition && !platformEnv.isNative
      ? { placement: contextMenuPlacement, allowFlip: false }
      : {};

  const actionList = (
    <BasicActionList
      {...restProps}
      {...contextMenuProps}
      defaultOpen
      renderTrigger={triggerElement}
      onOpenChange={handleOpenChange}
    />
  );

  // Wrap in a fixed-position container at cursor coordinates for context menu positioning
  const content =
    triggerPosition && !platformEnv.isNative ? (
      <Stack
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop
        style={{
          position: 'fixed' as const,
          left: triggerPosition.x,
          top: triggerPosition.y,
          width: 0,
          height: 0,
        }}
      >
        {actionList}
      </Stack>
    ) : (
      actionList
    );

  const modalCtxValue =
    modalNavigatorContext || FALLBACK_MODAL_NAVIGATOR_CONTEXT;
  const pageCtxValue = pageContextValue || FALLBACK_PAGE_CONTEXT;
  ref = Portal.Render(
    Portal.Constant.FULL_WINDOW_OVERLAY_PORTAL,
    // oxlint-disable-next-line react/jsx-no-constructed-context-values -- imperative Portal.Render, not a component render
    <ModalNavigatorContext.Provider value={modalCtxValue}>
      {/* oxlint-disable-next-line react/jsx-no-constructed-context-values */}
      <PageContext.Provider value={pageCtxValue}>
        {content}
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
  const contexts = useMemo(
    () => ({
      modalNavigatorContext,
      pageContextValue,
    }),
    [modalNavigatorContext, pageContextValue],
  );
  const handleActionListOpen = useCallback(() => {
    if (isProcessing.current) return;

    isProcessing.current = true;
    showActionList(popoverProps, contexts);
    setTimeout(() => {
      isProcessing.current = false;
    }, PROCESSING_RESET_DELAY);
  }, [popoverProps, contexts]);

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
