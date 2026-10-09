/* eslint-disable react/prop-types */
import type { ComponentProps, PropsWithChildren, ReactElement } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  OverlayView,
  useNestedOverlayLevel,
} from '@onekeyfe/react-native-native-overlay';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Button,
  SizableText,
  Stack,
  View,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { useSpotlightPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/spotlight';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import type { View as NativeView } from 'react-native';

export type ISpotlightViewProps = PropsWithChildren<{
  containerProps?: Omit<ComponentProps<typeof View>, 'children'>;
  content: ReactElement;
  childrenPaddingVertical?: number;
  childrenPaddingHorizontal?: number;
  showHighlightBackground?: boolean;
  highlightBackgroundOpacity?: number;
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

const EMPTY_POSITION: IFloatingPosition = { x: 0, y: 0, width: 0, height: 0 };
const SPOTLIGHT_BACKDROP = { color: 'rgba(0,0,0,0.3)' } as const;

export type ISpotlightProps = PropsWithChildren<{
  containerProps?: ISpotlightViewProps['containerProps'];
  isVisible?: boolean;
  message: string;
  tourName: ESpotlightTour;
  delayMs?: number;
  floatingOffset?: number;
  childrenPaddingVertical?: number;
  childrenPaddingHorizontal?: number;
  showHighlightBackground?: boolean;
  highlightBackgroundOpacity?: number;
  replaceChildren?: ReactElement;
}>;

// Renders in a blocking native overlay (`modal`, or the level of the overlay
// it lives in): the trigger is copied above a dimmed window at its measured
// window frame, with the message card below it. Back / Escape are swallowed;
// only "Done" ends the tour.
export function SpotlightView({
  containerProps,
  children,
  replaceChildren,
  content,
  childrenPaddingVertical = 8,
  childrenPaddingHorizontal = 8,
  showHighlightBackground = true,
  highlightBackgroundOpacity = 1,
  floatingOffset = 12,
  visible = false,
  onConfirm,
}: ISpotlightViewProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const level = useNestedOverlayLevel();
  const triggerRef = useRef<NativeView | null>(null);
  const [floatingPosition, setFloatingPosition] =
    useState<IFloatingPosition>(EMPTY_POSITION);

  useLayoutEffect(() => {
    if (!visible) {
      return;
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      if (platformEnv.isDev && width === 0) {
        console.error(
          'The Spotlight on the current page is not visible, so the measured width is 0. Please change the visibility to true when the page is focused',
        );
      }
      setFloatingPosition((prev) =>
        prev.x === x &&
        prev.y === y &&
        prev.width === width &&
        prev.height === height
          ? prev
          : { x, y, width, height },
      );
    });
  }, [visible, gtMd, windowWidth, windowHeight]);

  const isRendered = floatingPosition.width > 0;

  const floatingStyle = useMemo(
    () => ({
      top:
        floatingPosition.y +
        floatingPosition.height +
        floatingOffset +
        childrenPaddingVertical,
      left: gtMd ? floatingPosition.x - childrenPaddingHorizontal : '$4',
      right: gtMd ? undefined : '$4',
      maxWidth: gtMd ? 354 : undefined,
    }),
    [
      floatingPosition,
      floatingOffset,
      childrenPaddingVertical,
      gtMd,
      childrenPaddingHorizontal,
    ],
  );

  return (
    <>
      <View ref={triggerRef} collapsable={false} {...containerProps}>
        {children}
      </View>
      <OverlayView
        visible={visible && isRendered}
        level={level}
        presentation="fullscreen"
        backdrop={SPOTLIGHT_BACKDROP}
        dismissOnBackPress={false}
        testID="spotlight-content"
      >
        <Stack
          position="absolute"
          pointerEvents="none"
          top={floatingPosition.y - childrenPaddingVertical}
          left={floatingPosition.x - childrenPaddingHorizontal}
          borderRadius="$3"
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
          {/* Positioned, so it paints above the absolute background on web. */}
          <Stack position="relative">{replaceChildren || children}</Stack>
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
              testID="spotlight-btn"
              variant="primary"
              borderRadius="$2"
              size="small"
              onPress={onConfirm}
            >
              {intl.formatMessage({ id: ETranslations.global_done })}
            </Button>
          </XStack>
        </YStack>
      </OverlayView>
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
    children,
    containerProps,
    delayMs = 0,
    floatingOffset,
    childrenPaddingVertical,
    childrenPaddingHorizontal,
    showHighlightBackground,
    highlightBackgroundOpacity,
    replaceChildren,
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
      showHighlightBackground={showHighlightBackground}
      highlightBackgroundOpacity={highlightBackgroundOpacity}
      replaceChildren={replaceChildren}
    >
      {children}
    </SpotlightView>
  );
}
