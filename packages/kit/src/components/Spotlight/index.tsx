/* eslint-disable react/prop-types */
import type {
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

import type { IElement } from '@onekeyhq/components';
import {
  Button,
  EPortalContainerConstantName,
  Portal,
  Stack,
  View,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useSpotlightPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/spotlight';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useDeferredPromise } from '../../hooks/useDeferredPromise';
import { useRouteIsFocused } from '../../hooks/useRouteIsFocused';

import type { IDeferredPromise } from '../../hooks/useDeferredPromise';
import type { View as NativeView } from 'react-native';

export type ISpotlight = PropsWithChildren<{
  content: ReactElement;
  childrenPadding?: number;
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

type ISpotlightContentEvent = ISpotlight & {
  triggerRef: RefObject<NativeView>;
  floatingOffset: number;
  childrenPadding: number;
};
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

  const IsFocused = useRouteIsFocused();
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
        setFloatingPosition({
          x,
          y,
          width,
          height,
        });
      });
    }
  }, [initProps.triggerRef]);

  useEffect(() => {
    measureTriggerInWindow();
  }, [md, measureTriggerInWindow]);

  useLayoutEffect(() => {
    measureTriggerInWindow();
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
    childrenPadding,
  } = props;

  const isRendered = floatingPosition.width > 0;

  const floatingStyle = useMemo(
    () =>
      isRendered
        ? {
            top:
              floatingPosition.y +
              floatingPosition.height +
              floatingOffset +
              childrenPadding,
            left: gtMd ? floatingPosition.x - childrenPadding : '$4',
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
      childrenPadding,
      gtMd,
    ],
  );

  if (visible && isRendered && IsFocused)
    return (
      <Stack
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
          top={floatingPosition.y - childrenPadding}
          left={floatingPosition.x - childrenPadding}
          borderRadius="$3"
          padding={childrenPadding}
        >
          {children}
        </Stack>
        <YStack
          position="absolute"
          bg="$bg"
          px="$4"
          py="$3.5"
          space="$3.5"
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

export function Spotlight({
  children,
  replaceChildren,
  content,
  childrenPadding = 8,
  floatingOffset = 12,
  visible = false,
  onConfirm,
}: ISpotlight) {
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
        childrenPadding,
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
    childrenPadding,
  ]);
  // const handleLayout = useCallback(() => {
  //   (triggerRef?.current as any as NativeView)?.measureInWindow(
  //     (x, y, width, height) => {
  //       console.log('onlayout---', x, y, width, height);x
  //     },
  //   );
  // }, []);

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
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
              childrenPadding,
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
  const tourVisited = useCallback(async () => {
    void backgroundApiProxy.serviceSpotlight.updateTourTimes(tourName);
  }, [tourName]);
  return useMemo(
    () => ({
      isFirstVisit: times === 0,
      tourVisited,
    }),
    [times, tourVisited],
  );
};
