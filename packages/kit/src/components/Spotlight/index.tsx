/* eslint-disable react/prop-types */
import type {
  ComponentProps,
  MutableRefObject,
  PropsWithChildren,
  ReactElement,
  RefObject,
} from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  EPortalContainerConstantName,
  Portal,
  SizableText,
  Stack,
  View,
  XStack,
  YStack,
  useBackHandler,
  useDeferredPromise,
  useMedia,
} from '@onekeyhq/components';
import type { IDeferredPromise, IElement } from '@onekeyhq/components';
import {
  useDeferredGuideBlocker,
  useIsDeferredGuideBlocked,
} from '@onekeyhq/components/src/hooks/useDeferredGuideBlocker';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { useSpotlightPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/spotlight';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { useSpotlightAnchorVisibility } from './useSpotlightAnchorVisibility';

import type { View as NativeView } from 'react-native';

export type ISpotlightViewProps = PropsWithChildren<{
  anchorRef?: RefObject<IElement | null>;
  onAnchorLayout?: () => void;
  containerProps?: Omit<ComponentProps<typeof View>, 'children'>;
  content: ReactElement;
  cardBorderRadius?: number;
  highlightBorderRadius?: number;
  confirmButtonBorderRadius?: ComponentProps<typeof Button>['borderRadius'];
  confirmButtonPaddingHorizontal?: number;
  cardPadding?: number;
  cardPaddingBottom?: number;
  cardGap?: number;
  cardMaxWidth?: number;
  childrenPaddingVertical?: number;
  childrenPaddingHorizontal?: number;
  showHighlightBackground?: boolean;
  highlightBackgroundOpacity?: number;
  floatingOffset?: number;
  visible: boolean;
  onConfirm?: () => void;
  confirmText?: string;
  closeOnBackdropPress?: boolean;
  matchTriggerSize?: boolean;
  deferUntilIdle?: boolean;
  replaceChildren?: ReactElement;
}>;

interface IFloatingPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ISpotlightContentEvent = ISpotlightViewProps & {
  triggerRef: RefObject<NativeView>;
  floatingOffset: number;
  childrenPaddingVertical?: number;
  childrenPaddingHorizontal?: number;
};

export type ISpotlightProps = PropsWithChildren<{
  containerProps?: ISpotlightViewProps['containerProps'];
  isVisible?: boolean;
  message: string;
  illustration?: ReactElement;
  illustrationGap?: number;
  cardBorderRadius?: number;
  highlightBorderRadius?: number;
  confirmButtonBorderRadius?: ISpotlightViewProps['confirmButtonBorderRadius'];
  confirmButtonPaddingHorizontal?: number;
  cardPadding?: number;
  cardPaddingBottom?: number;
  cardGap?: number;
  cardMaxWidth?: number;
  confirmText?: string;
  tourName: ESpotlightTour;
  delayMs?: number;
  floatingOffset?: number;
  childrenPaddingVertical?: number;
  childrenPaddingHorizontal?: number;
  showHighlightBackground?: boolean;
  highlightBackgroundOpacity?: number;
  replaceChildren?: ReactElement;
  closeOnBackdropPress?: boolean;
  matchTriggerSize?: boolean;
  deferUntilIdle?: boolean;
  requireVisibleAnchor?: boolean;
}>;

function SpotlightContent({
  initProps,
  triggerPropsRef,
}: {
  initProps: ISpotlightContentEvent;
  triggerPropsRef: MutableRefObject<{
    defer?: IDeferredPromise<unknown>;
    trigger: ((props: ISpotlightContentEvent) => void) | undefined;
  }>;
}) {
  const intl = useIntl();
  const isGuideBlocked = useIsDeferredGuideBlocked();

  const { gtMd } = useMedia();
  const [props, setProps] = useState(initProps);
  const [floatingPosition, setFloatingPosition] = useState<IFloatingPosition>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const md = useMedia();

  const measureTriggerInWindow = useCallback(() => {
    if (initProps.triggerRef) {
      const noNativeNavigator =
        platformEnv.isDesktopWin || platformEnv.isDesktopLinux;

      // Requires a -30px offset to compensate for window title bar height
      const extraY = noNativeNavigator ? -30 : 0;

      initProps.triggerRef.current?.measureInWindow((x, y, width, height) => {
        if (
          floatingPosition.x === x &&
          floatingPosition.y === y + extraY &&
          floatingPosition.width === width &&
          floatingPosition.height === height
        ) {
          return;
        }
        setFloatingPosition({
          x,
          y: y + extraY,
          width,
          height,
        });
      });
    }
  }, [initProps.triggerRef, floatingPosition]);

  useLayoutEffect(() => {
    measureTriggerInWindow();
  }, [md, measureTriggerInWindow]);

  useLayoutEffect(() => {
    if (triggerPropsRef.current) {
      triggerPropsRef.current.trigger = (params) => {
        setProps(params);
      };
      if (triggerPropsRef.current.defer) {
        triggerPropsRef.current.defer.resolve(undefined);
      }
    }
  }, [initProps.triggerRef, measureTriggerInWindow, triggerPropsRef]);
  const {
    visible,
    children,
    content,
    cardBorderRadius,
    highlightBorderRadius,
    confirmButtonBorderRadius,
    confirmButtonPaddingHorizontal,
    cardPadding,
    cardPaddingBottom,
    cardGap,
    cardMaxWidth,
    onConfirm,
    confirmText,
    closeOnBackdropPress = false,
    matchTriggerSize = false,
    deferUntilIdle = false,
    floatingOffset,
    childrenPaddingHorizontal = 8,
    childrenPaddingVertical = 8,
    showHighlightBackground = true,
    highlightBackgroundOpacity = 1,
  } = props;

  const isRendered = floatingPosition.width > 0;

  if (platformEnv.isDev && !isRendered) {
    console.error(
      'The Spotlight on the current page is not visible, so the measured width is 0. Please change the visibility to true when the page is focused',
    );
  }

  const floatingStyle = useMemo(
    () =>
      isRendered
        ? {
            top:
              floatingPosition.y +
              floatingPosition.height +
              floatingOffset +
              childrenPaddingVertical,
            left: gtMd ? floatingPosition.x - childrenPaddingHorizontal : '$4',
            right: gtMd ? undefined : '$4',
            maxWidth: cardMaxWidth ?? (gtMd ? 354 : undefined),
          }
        : undefined,
    [
      isRendered,
      floatingPosition.y,
      floatingPosition.height,
      floatingPosition.x,
      floatingOffset,
      childrenPaddingVertical,
      gtMd,
      childrenPaddingHorizontal,
      cardMaxWidth,
    ],
  );

  const handleBackPress = useCallback(() => true, []);
  useBackHandler(handleBackPress);
  if (visible && isRendered && !(deferUntilIdle && isGuideBlocked))
    return (
      <Stack
        testID="spotlight-content"
        transition="quick"
        animateOnly={ANIMATE_ONLY_OPACITY}
        bg="rgba(0,0,0,0.3)"
        position="absolute"
        top={0}
        left={0}
        bottom={0}
        right={0}
        enterStyle={{
          opacity: 0,
        }}
        exitStyle={{ opacity: 0 }}
      >
        <Stack
          testID="spotlight-backdrop"
          position="absolute"
          inset={0}
          onPress={closeOnBackdropPress ? onConfirm : undefined}
          accessible={false}
        />
        <Stack
          testID="spotlight-highlight"
          position="absolute"
          pointerEvents="none"
          top={floatingPosition.y - childrenPaddingVertical}
          left={floatingPosition.x - childrenPaddingHorizontal}
          width={
            matchTriggerSize
              ? floatingPosition.width + childrenPaddingHorizontal * 2
              : undefined
          }
          height={
            matchTriggerSize
              ? floatingPosition.height + childrenPaddingVertical * 2
              : undefined
          }
          borderRadius={highlightBorderRadius ?? '$3'}
          px={childrenPaddingHorizontal}
          py={childrenPaddingVertical}
          overflow="hidden"
        >
          {showHighlightBackground ? (
            <Stack
              position="absolute"
              inset={0}
              bg="$bg"
              opacity={highlightBackgroundOpacity}
            />
          ) : null}
          {children}
        </Stack>
        <YStack
          testID="spotlight-card"
          position="absolute"
          bg="$bg"
          px={cardPadding ?? '$4'}
          py={cardPadding ?? '$3.5'}
          pb={cardPaddingBottom ?? cardPadding ?? '$3.5'}
          gap={cardGap ?? '$3.5'}
          borderRadius={cardBorderRadius ?? '$3'}
          outlineColor="$borderSubdued"
          outlineStyle="solid"
          outlineWidth="$px"
          elevation={20}
          {...floatingStyle}
        >
          <Stack>{content}</Stack>
          <XStack jc="flex-end">
            <Button
              testID="spotlight-btn"
              variant="primary"
              borderRadius={confirmButtonBorderRadius ?? '$2'}
              px={confirmButtonPaddingHorizontal}
              size="small"
              onPress={onConfirm}
            >
              {confirmText ??
                intl.formatMessage({ id: ETranslations.global_done })}
            </Button>
          </XStack>
        </YStack>
      </Stack>
    );

  return null;
}

export function SpotlightView({
  anchorRef,
  onAnchorLayout,
  containerProps,
  children,
  replaceChildren,
  content,
  cardBorderRadius,
  highlightBorderRadius,
  confirmButtonBorderRadius,
  confirmButtonPaddingHorizontal,
  cardPadding,
  cardPaddingBottom,
  cardGap,
  cardMaxWidth,
  childrenPaddingVertical,
  childrenPaddingHorizontal,
  showHighlightBackground,
  highlightBackgroundOpacity,
  floatingOffset = 12,
  visible = false,
  onConfirm,
  confirmText,
  closeOnBackdropPress,
  matchTriggerSize,
  deferUntilIdle,
}: ISpotlightViewProps) {
  useDeferredGuideBlocker(visible && !deferUntilIdle);
  const defer = useDeferredPromise();
  const localTriggerRef = useRef<IElement | null>(null);
  const triggerRef = anchorRef ?? localTriggerRef;
  const triggerPropsRef = useRef<{
    trigger: ((props: ISpotlightContentEvent) => void) | undefined;
    defer: IDeferredPromise<unknown>;
  }>({
    trigger: undefined,
    defer,
  });
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      await defer.promise;
      if (cancelled) return;
      triggerPropsRef.current.trigger?.({
        visible,
        children: replaceChildren || children,
        content,
        cardBorderRadius,
        highlightBorderRadius,
        confirmButtonBorderRadius,
        confirmButtonPaddingHorizontal,
        cardPadding,
        cardPaddingBottom,
        cardGap,
        cardMaxWidth,
        onConfirm,
        confirmText,
        closeOnBackdropPress,
        matchTriggerSize,
        deferUntilIdle,
        triggerRef: triggerRef as RefObject<NativeView>,
        floatingOffset,
        childrenPaddingVertical,
        childrenPaddingHorizontal,
        showHighlightBackground,
        highlightBackgroundOpacity,
      });
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    children,
    content,
    cardBorderRadius,
    highlightBorderRadius,
    confirmButtonBorderRadius,
    confirmButtonPaddingHorizontal,
    cardPadding,
    cardPaddingBottom,
    cardGap,
    cardMaxWidth,
    defer,
    floatingOffset,
    onConfirm,
    confirmText,
    closeOnBackdropPress,
    matchTriggerSize,
    deferUntilIdle,
    replaceChildren,
    visible,
    childrenPaddingVertical,
    childrenPaddingHorizontal,
    showHighlightBackground,
    highlightBackgroundOpacity,
    triggerRef,
  ]);

  return (
    <>
      {onAnchorLayout ? (
        <Stack
          ref={triggerRef}
          collapsable={false}
          onLayout={onAnchorLayout}
          {...containerProps}
        >
          {children}
        </Stack>
      ) : (
        <View ref={triggerRef} collapsable={false} {...containerProps}>
          {children}
        </View>
      )}
      {visible ? (
        <Portal.Body
          destroyDelayMs={deferUntilIdle ? 0 : 1200}
          container={EPortalContainerConstantName.SPOTLIGHT_OVERLAY_PORTAL}
        >
          <SpotlightContent
            triggerPropsRef={triggerPropsRef}
            initProps={{
              visible,
              children: replaceChildren || children,
              content,
              cardBorderRadius,
              highlightBorderRadius,
              confirmButtonBorderRadius,
              confirmButtonPaddingHorizontal,
              cardPadding,
              cardPaddingBottom,
              cardGap,
              cardMaxWidth,
              onConfirm,
              confirmText,
              closeOnBackdropPress,
              matchTriggerSize,
              deferUntilIdle,
              floatingOffset,
              childrenPaddingVertical,
              childrenPaddingHorizontal,
              showHighlightBackground,
              highlightBackgroundOpacity,
              triggerRef: triggerRef as RefObject<NativeView>,
            }}
          />
        </Portal.Body>
      ) : null}
    </>
  );
}

export const useSpotlight = (tourName: ESpotlightTour) => {
  const [{ data }] = useSpotlightPersistAtom();
  const times = data[tourName] ?? 0;
  const tourVisited = useCallback(
    async (manualTimes?: number) => {
      void backgroundApiProxy.serviceSpotlight.updateTourTimes({
        tourName,
        manualTimes,
      });
    },
    [tourName],
  );
  return useMemo(
    () => ({
      isFirstVisit: times === 0,
      tourVisited,
      tourTimes: times || 0,
    }),
    [times, tourVisited],
  );
};

export function Spotlight(props: ISpotlightProps) {
  const {
    isVisible,
    tourName,
    message,
    illustration,
    illustrationGap,
    cardBorderRadius,
    highlightBorderRadius,
    confirmButtonBorderRadius,
    confirmButtonPaddingHorizontal,
    cardPadding,
    cardPaddingBottom,
    cardGap,
    cardMaxWidth,
    confirmText,
    children,
    containerProps,
    delayMs = 0,
    floatingOffset,
    childrenPaddingVertical,
    childrenPaddingHorizontal,
    showHighlightBackground,
    highlightBackgroundOpacity,
    replaceChildren,
    closeOnBackdropPress,
    matchTriggerSize,
    deferUntilIdle = false,
    requireVisibleAnchor = false,
  } = props;
  const [isLocked] = useAppIsLockedAtom();
  const isGuideBlocked = useIsDeferredGuideBlocked();
  const { isFirstVisit, tourVisited } = useSpotlight(tourName);
  const triggerRef = useRef<IElement | null>(null);
  const shouldCheckAnchor =
    requireVisibleAnchor && !!isVisible && isFirstVisit && !isLocked;
  const { isAnchorVisible, measureAnchor } = useSpotlightAnchorVisibility(
    triggerRef,
    shouldCheckAnchor,
  );
  const checkAnchorVisibility = requireVisibleAnchor
    ? measureAnchor
    : undefined;
  const canShow =
    !!isVisible &&
    !(deferUntilIdle && isGuideBlocked) &&
    (!requireVisibleAnchor || isAnchorVisible);
  const onAnchorLayout = useCallback(() => {
    if (shouldCheckAnchor) measureAnchor();
  }, [measureAnchor, shouldCheckAnchor]);
  const [isShow, setIsShow] = useState(false);
  useLayoutEffect(() => {
    if (deferUntilIdle && !canShow) setIsShow(false);
  }, [canShow, deferUntilIdle]);
  useEffect(() => {
    let cancelled = false;
    const timerId = setTimeout(
      () => {
        if (checkAnchorVisibility && canShow) {
          checkAnchorVisibility((isInViewport) => {
            if (!cancelled) setIsShow(isInViewport);
          });
        } else {
          setIsShow(canShow);
        }
      },
      canShow ? delayMs : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [delayMs, canShow, checkAnchorVisibility]);
  const visible =
    isFirstVisit && isShow && !isLocked && (!deferUntilIdle || canShow);

  return (
    <SpotlightView
      anchorRef={triggerRef}
      onAnchorLayout={requireVisibleAnchor ? onAnchorLayout : undefined}
      visible={visible}
      cardBorderRadius={cardBorderRadius}
      highlightBorderRadius={highlightBorderRadius}
      confirmButtonBorderRadius={confirmButtonBorderRadius}
      confirmButtonPaddingHorizontal={confirmButtonPaddingHorizontal}
      cardPadding={cardPadding}
      cardPaddingBottom={cardPaddingBottom}
      cardGap={cardGap}
      cardMaxWidth={cardMaxWidth}
      content={
        illustration ? (
          <YStack gap={illustrationGap ?? '$3'}>
            {illustration}
            <SizableText size="$bodyMd">{message}</SizableText>
          </YStack>
        ) : (
          <SizableText size="$bodyMd">{message}</SizableText>
        )
      }
      onConfirm={() => tourVisited()}
      confirmText={confirmText}
      closeOnBackdropPress={closeOnBackdropPress}
      matchTriggerSize={matchTriggerSize}
      deferUntilIdle={deferUntilIdle}
      containerProps={containerProps}
      floatingOffset={floatingOffset}
      childrenPaddingVertical={childrenPaddingVertical}
      childrenPaddingHorizontal={childrenPaddingHorizontal}
      showHighlightBackground={showHighlightBackground}
      highlightBackgroundOpacity={highlightBackgroundOpacity}
      replaceChildren={replaceChildren}
    >
      {children}
    </SpotlightView>
  );
}
