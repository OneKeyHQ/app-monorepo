import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWindowDimensions } from 'react-native';

import {
  SizableText,
  Stack,
  XStack,
  YStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { PopoverContext } from '@onekeyhq/components/src/actions/Popover/context';
import {
  runPopoverCloseSideEffects,
  runPopoverOpenSideEffects,
} from '@onekeyhq/components/src/actions/Popover/popoverSideEffects';
import { useNativePortalLifecycle } from '@onekeyhq/components/src/actions/Popover/useNativePortalLifecycle';
import { Trigger } from '@onekeyhq/components/src/actions/Trigger';
import { NativeSheetPresentation } from '@onekeyhq/components/src/hocs/NativeSheetPresentation';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IStockSelectorPopoverProps } from './StockSelectorPopover.type';

export function StockSelectorPopover({
  open,
  onOpenChange,
  title,
  description,
  showHeader = true,
  renderTrigger,
  renderContent,
  sheetProps,
  trackID,
}: IStockSelectorPopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const openRef = useRef(isOpen);
  const callbacksRef = useRef({ onOpenChange, trackID });
  openRef.current = isOpen;
  callbacksRef.current = { onOpenChange, trackID };

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (openRef.current === nextOpen) return;
      openRef.current = nextOpen;
      if (open === undefined) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, open],
  );
  const openPopover = useCallback(() => setOpen(true), [setOpen]);
  const closePopover = useCallback(() => {
    setOpen(false);
    return Promise.resolve();
  }, [setOpen]);

  const hadOpenSideEffectsRef = useRef(false);
  useEffect(() => {
    if (hadOpenSideEffectsRef.current === isOpen) return;
    hadOpenSideEffectsRef.current = isOpen;
    if (isOpen) runPopoverOpenSideEffects(trackID);
    else runPopoverCloseSideEffects(trackID);
  }, [isOpen, trackID]);

  useEffect(
    () => () => {
      // A pending selection must also be cancelled when navigation removes
      // the trigger before the native dismissal callback can arrive.
      if (openRef.current) callbacksRef.current.onOpenChange?.(false);
      if (hadOpenSideEffectsRef.current) {
        runPopoverCloseSideEffects(callbacksRef.current.trackID);
      }
    },
    [],
  );

  const { isNativePortalMounted, popoverOpen, resolvedSheetProps } =
    useNativePortalLifecycle({
      isOpen,
      sheetProps,
      mountNativePortalBeforeOpen: true,
    });
  const { height: viewportHeight } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  // iOS adds this inset below a custom detent. Android's detent includes it.
  const systemBottomInset = platformEnv.isNativeIOS ? bottom : 0;
  const maxHeight = Math.max(
    1,
    Math.min(viewportHeight * 0.92, viewportHeight - top) - systemBottomInset,
  );
  const firstSnapPoint = sheetProps?.snapPoints?.[0];
  let requestedHeight: number | undefined;
  if (typeof firstSnapPoint === 'number') {
    if (sheetProps?.snapPointsMode === 'percent') {
      requestedHeight =
        (viewportHeight * firstSnapPoint) / 100 - systemBottomInset;
    } else if (sheetProps?.snapPointsMode === 'constant') {
      requestedHeight = firstSnapPoint - systemBottomInset;
    }
  }
  const height =
    requestedHeight === undefined
      ? undefined
      : Math.max(1, Math.min(requestedHeight, maxHeight));
  const bottomPadding = Math.max(0, bottom - systemBottomInset);
  const popoverContext = useMemo(
    () => ({ open: isOpen, closePopover }),
    [closePopover, isOpen],
  );
  const RenderContent =
    typeof renderContent === 'function' ? renderContent : undefined;
  let content: ReactNode = null;
  if (RenderContent) {
    content = <RenderContent isOpen={isOpen} closePopover={closePopover} />;
  } else if (typeof renderContent !== 'function') {
    content = renderContent;
  }

  return (
    <>
      <Trigger testID="stock-selector-trigger" onPress={openPopover}>
        {renderTrigger}
      </Trigger>
      {isNativePortalMounted ? (
        <NativeSheetPresentation
          testID="stock-selector-sheet"
          open={Boolean(popoverOpen)}
          height={height}
          maxHeight={maxHeight}
          onOpenChange={setOpen}
          onAnimationComplete={resolvedSheetProps?.onAnimationComplete}
          dismissOnOverlayPress={sheetProps?.dismissOnOverlayPress ?? true}
          dismissOnSnapToBottom={sheetProps?.dismissOnSnapToBottom ?? true}
          disableDrag={sheetProps?.disableDrag}
          showHandle={false}
          cornerRadius={20}
        >
          <PopoverContext.Provider value={popoverContext}>
            <YStack
              width="100%"
              height={height}
              maxHeight={maxHeight}
              pb={bottomPadding}
              bg="$bg"
              overflow="hidden"
            >
              <Stack
                height={showHeader ? 24 : 28}
                alignItems="center"
                pt="$2"
                flexShrink={0}
              >
                <Stack
                  width={36}
                  height={5}
                  borderRadius={2.5}
                  bg="$neutral6"
                />
              </Stack>
              {showHeader ? (
                <XStack
                  px="$4"
                  pb="$3"
                  gap="$2"
                  alignItems="flex-start"
                  flexShrink={0}
                >
                  <YStack flex={1} minWidth={0}>
                    {typeof title === 'string' ? (
                      <SizableText size="$headingMd">{title}</SizableText>
                    ) : (
                      title
                    )}
                    {description ? (
                      <SizableText size="$bodyMd" color="$textSubdued" pt="$2">
                        {description}
                      </SizableText>
                    ) : null}
                  </YStack>
                </XStack>
              ) : null}
              <YStack
                flex={height === undefined ? undefined : 1}
                flexShrink={1}
                minHeight={0}
              >
                {content}
              </YStack>
            </YStack>
          </PopoverContext.Provider>
        </NativeSheetPresentation>
      ) : null}
    </>
  );
}

export type { IStockSelectorPopoverProps } from './StockSelectorPopover.type';
