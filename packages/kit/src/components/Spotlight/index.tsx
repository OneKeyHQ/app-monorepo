/* eslint-disable react/prop-types */
import type { MutableRefObject, PropsWithChildren, ReactElement } from 'react';
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
  AnimatePresence,
  Button,
  EPortalContainerConstantName,
  Portal,
  Stack,
  View,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useDeferredPromise } from '../../hooks/useDeferredPromise';

import type { IDeferredPromise } from '../../hooks/useDeferredPromise';
import type { View as NativeView } from 'react-native';

export type ISpotlight = PropsWithChildren<{
  content: ReactElement;
  offset?: number;
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
  floatingPosition: IFloatingPosition;
  offset: number;
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

  const [isLocked] = useAppIsLockedAtom();
  const { gtMd } = useMedia();
  const [props, setProps] = useState(initProps);

  useLayoutEffect(() => {
    if (triggerPropsRef.current) {
      triggerPropsRef.current.trigger = (params) => {
        setProps(params);
      };
      if (triggerPropsRef.current.defer) {
        triggerPropsRef.current.defer.resolve(undefined);
      }
    }
  }, [triggerPropsRef]);
  const { visible, children, floatingPosition, content, onConfirm, offset } =
    props;

  const floatingStyle = useMemo(
    () =>
      floatingPosition
        ? {
            top: floatingPosition.y + floatingPosition.height + offset,
            left: gtMd ? floatingPosition.x : '$4',
            right: gtMd ? undefined : '$4',
            maxWidth: gtMd ? 354 : undefined,
          }
        : undefined,
    [floatingPosition, gtMd, offset],
  );

  const isRendered = floatingPosition.width > 0;
  return (
    <AnimatePresence>
      {visible && isRendered && !isLocked ? (
        <Stack
          flex={1}
          bg="rgba(0,0,0,0.2)"
          position="absolute"
          top={0}
          left={0}
          bottom={0}
          right={0}
          enterStyle={{
            scale: 0.95,
            opacity: 0,
          }}
          exitStyle={{ scale: 0.95, opacity: 0 }}
        >
          <Stack
            position="absolute"
            pointerEvents="none"
            bg="$bg"
            top={floatingPosition.y}
            left={floatingPosition.x}
            borderRadius="$full"
          >
            {children}
          </Stack>
          <YStack
            position="absolute"
            bg="$bg"
            px="$4"
            py="$3.5"
            space="$2"
            borderRadius="$3"
            {...floatingStyle}
          >
            <Stack>{content}</Stack>
            <XStack jc="flex-end">
              <Button borderRadius="$2" size="small" onPress={onConfirm}>
                {intl.formatMessage({ id: ETranslations.global_got_it })}
              </Button>
            </XStack>
          </YStack>
        </Stack>
      ) : null}
    </AnimatePresence>
  );
}

export function Spotlight({
  children,
  replaceChildren,
  content,
  offset = 12,
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
  const [floatingPosition, setFloatingPosition] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  useEffect(() => {
    setTimeout(async () => {
      await defer.promise;
      triggerPropsRef.current.trigger?.({
        visible,
        children: replaceChildren || children,
        floatingPosition,
        content,
        onConfirm,
        offset,
      });
    });
  }, [
    children,
    content,
    defer,
    floatingPosition,
    offset,
    onConfirm,
    replaceChildren,
    visible,
  ]);
  const handleLayout = useCallback(() => {
    (triggerRef?.current as any as NativeView)?.measureInWindow(
      (x, y, width, height) => {
        setFloatingPosition({
          x,
          y,
          width,
          height,
        });
      },
    );
  }, [setFloatingPosition]);

  return (
    <>
      <View ref={triggerRef} collapsable={false} onLayout={handleLayout}>
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
              floatingPosition,
              content,
              onConfirm,
              offset,
            }}
          />
        </Portal.Body>
      ) : null}
    </>
  );
}
