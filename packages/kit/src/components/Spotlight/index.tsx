/* eslint-disable react/prop-types */
import type {
  MutableRefObject,
  PropsWithChildren,
  ReactElement,
  ReactNode,
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

import type { IElement, IStackStyle } from '@onekeyhq/components';
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
  useMedia,
} from '@onekeyhq/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useSpotlightPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/spotlight';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useDeferredPromise } from '../../hooks/useDeferredPromise';

import type { IDeferredPromise } from '../../hooks/useDeferredPromise';
import type { View as NativeView } from 'react-native';

export type ISpotlightViewProps = PropsWithChildren<{
  containerProps?: IStackStyle;
  content: ReactElement;
  childrenPaddingVertical?: number;
  childrenPaddingHorizontal?: number;
  floatingOffset?: number;
  visible: boolean;
  onConfirm?: () => void;
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
  tourName: ESpotlightTour;
  delayMs?: number;
  floatingOffset?: number;
  childrenPaddingVertical?: number;
  childrenPaddingHorizontal?: number;
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
      initProps.triggerRef.current?.measureInWindow((x, y, width, height) => {
        if (
          floatingPosition.x === x &&
          floatingPosition.y === y &&
          floatingPosition.width === width &&
          floatingPosition.height === height
        ) {
          return;
        }
        setFloatingPosition({
          x,
          y,
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
    onConfirm,
    floatingOffset,
    childrenPaddingHorizontal = 8,
    childrenPaddingVertical = 8,
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
            maxWidth: gtMd ? 354 : undefined,
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
    ],
  );

  const handleBackPress = useCallback(() => true, []);
  useBackHandler(handleBackPress);
  if (visible && isRendered)
    return (
      <Stack
        testID="spotlight-content"
        animation="quick"
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
          position="absolute"
          pointerEvents="none"
          bg="$bg"
          top={floatingPosition.y - childrenPaddingVertical}
          left={floatingPosition.x - childrenPaddingHorizontal}
          borderRadius="$3"
          px={childrenPaddingHorizontal}
          py={childrenPaddingVertical}
        >
          {children}
        </Stack>
        <YStack
          position="absolute"
          bg="$bg"
          px="$4"
          py="$3.5"
          gap="$3.5"
          borderRadius="$3"
          outlineColor="$borderSubdued"
          outlineStyle="solid"
          outlineWidth="$px"
          elevation={20}
          {...floatingStyle}
        >
          <Stack>{content}</Stack>
          <XStack jc="flex-end">
            <Button
              variant="primary"
              borderRadius="$2"
              size="small"
              onPress={onConfirm}
            >
              {intl.formatMessage({ id: ETranslations.global_done })}
            </Button>
          </XStack>
        </YStack>
      </Stack>
    );

  return null;
}

export function SpotlightView({
  containerProps,
  children,
  replaceChildren,
  content,
  childrenPaddingVertical,
  childrenPaddingHorizontal,
  floatingOffset = 12,
  visible = false,
  onConfirm,
}: ISpotlightViewProps) {
  const defer = useDeferredPromise();
  const triggerRef = useRef<IElement | null>(null);
  const triggerPropsRef = useRef<{
    trigger: ((props: ISpotlightContentEvent) => void) | undefined;
    defer: IDeferredPromise<unknown>;
  }>({
    trigger: undefined,
    defer,
  });
  useEffect(() => {
    setTimeout(async () => {
      await defer.promise;
      triggerPropsRef.current.trigger?.({
        visible,
        children: replaceChildren || children,
        content,
        onConfirm,
        triggerRef: triggerRef as any,
        floatingOffset,
        childrenPaddingVertical,
        childrenPaddingHorizontal,
      });
    });
  }, [
    children,
    content,
    defer,
    floatingOffset,
    onConfirm,
    replaceChildren,
    visible,
    childrenPaddingVertical,
    childrenPaddingHorizontal,
  ]);

  return (
    <>
      <View ref={triggerRef} collapsable={false} {...containerProps}>
        {children}
      </View>
      {visible ? (
        <Portal.Body
          destroyDelayMs={1200}
          container={EPortalContainerConstantName.SPOTLIGHT_OVERLAY_PORTAL}
        >
          <SpotlightContent
            triggerPropsRef={triggerPropsRef}
            initProps={{
              visible,
              children: replaceChildren || children,
              content,
              onConfirm,
              floatingOffset,
              childrenPaddingVertical,
              childrenPaddingHorizontal,
              triggerRef: triggerRef as any,
            }}
          />
        </Portal.Body>
      ) : null}
    </>
  );
}

export const useSpotlight = (tourName: ESpotlightTour) => {
  const [{ data }] = useSpotlightPersistAtom();
  const times = data[tourName];
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
      tourTimes: times,
    }),
    [times, tourVisited],
  );
};

export function Spotlight(props: ISpotlightProps) {
  const {
    isVisible,
    tourName,
    message,
    children,
    containerProps,
    delayMs = 0,
    floatingOffset,
    childrenPaddingVertical,
    childrenPaddingHorizontal,
  } = props;
  const [isLocked] = useAppIsLockedAtom();
  const { isFirstVisit, tourVisited } = useSpotlight(tourName);
  const [isShow, setIsShow] = useState(false);
  useEffect(() => {
    const timerId = setTimeout(
      () => {
        setIsShow(!!isVisible);
      },
      isVisible ? delayMs : 0,
    );
    return () => clearTimeout(timerId);
  }, [delayMs, isVisible]);
  const visible = isFirstVisit && isShow && !isLocked;

  return (
    <SpotlightView
      visible={visible}
      content={<SizableText size="$bodyMd">{message}</SizableText>}
      onConfirm={() => tourVisited()}
      containerProps={containerProps}
      floatingOffset={floatingOffset}
      childrenPaddingVertical={childrenPaddingVertical}
      childrenPaddingHorizontal={childrenPaddingHorizontal}
    >
      {children}
    </SpotlightView>
  );
}
