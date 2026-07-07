import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { SizableText, YStack } from '../primitives';

import { IconButton } from './IconButton';
import { runPopoverOpenSideEffects } from './Popover/popoverSideEffects';
import { Trigger } from './Trigger';

import type { IIconButtonProps } from './IconButton';
import type { IPopoverProps } from './Popover';
import type { IPopoverTooltip } from './Popover/type';

type ILazyPopoverComponent = typeof import('./Popover').Popover;

let loadedPopover: ILazyPopoverComponent | undefined;
let loadPopoverPromise: Promise<ILazyPopoverComponent> | undefined;

function loadPopover() {
  if (!loadPopoverPromise) {
    const promise = import('./Popover')
      .then((module) => {
        loadedPopover = module.Popover;
        return module.Popover;
      })
      .catch((error: unknown) => {
        if (loadPopoverPromise === promise) {
          loadPopoverPromise = undefined;
        }
        throw error;
      });
    loadPopoverPromise = promise;
  }
  return loadPopoverPromise;
}

function logPopoverLoadError(error: unknown) {
  const err = error as { message?: string; stack?: string };
  defaultLogger.app.error.log(
    `[LazyPopover] FAILED: ${err?.message || String(error)}\n${err?.stack?.slice(0, 300) || ''}`,
  );
}

export function preloadLazyPopover() {
  return loadPopover();
}

function LazyPopoverFrame(props: IPopoverProps) {
  const { renderTrigger, open, onOpenChange, trackID } = props;
  const [PopoverComponent, setPopoverComponent] = useState<
    ILazyPopoverComponent | undefined
  >(() => loadedPopover);
  const [localOpen, setLocalOpen] = useState(false);
  const isMountedRef = useRef(true);
  const isControlled = typeof open !== 'undefined';
  const actualOpen = isControlled ? open : localOpen;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setLocalOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const ensureLoaded = useCallback(
    (nextOpen?: boolean) => {
      void loadPopover()
        .then((Component) => {
          if (!isMountedRef.current) {
            return;
          }
          setPopoverComponent(() => Component);
          if (nextOpen !== undefined) {
            handleOpenChange(nextOpen);
            if (nextOpen) {
              runPopoverOpenSideEffects(trackID);
            }
          }
        })
        .catch((error: unknown) => {
          logPopoverLoadError(error);
        });
    },
    [handleOpenChange, trackID],
  );

  useEffect(() => {
    if (actualOpen && !PopoverComponent) {
      ensureLoaded();
    }
  }, [actualOpen, ensureLoaded, PopoverComponent]);

  const handleTriggerPress = useCallback(() => {
    if (PopoverComponent) {
      handleOpenChange(true);
    } else {
      ensureLoaded(true);
    }
  }, [ensureLoaded, handleOpenChange, PopoverComponent]);

  if (PopoverComponent) {
    return (
      <PopoverComponent
        {...props}
        open={actualOpen}
        onOpenChange={handleOpenChange}
      />
    );
  }

  return (
    <Trigger
      testID={trackID ? `${trackID}-trigger` : 'lazy-popover-trigger'}
      onPress={handleTriggerPress}
    >
      {renderTrigger}
    </Trigger>
  );
}

function LazyPopoverTooltip({
  tooltip,
  title,
  placement = 'bottom',
  iconSize = '$4',
  renderContent,
  triggerProps,
}: IPopoverTooltip & {
  iconSize?: IIconButtonProps['iconSize'];
}) {
  const triggerMemo = useMemo(
    () => (
      <IconButton
        testID="lazy-popover-tooltip-trigger"
        iconColor="$iconSubdued"
        iconSize={iconSize}
        icon="InfoCircleOutline"
        variant="tertiary"
        {...triggerProps}
      />
    ),
    [iconSize, triggerProps],
  );

  const contentMemo = useMemo(
    () =>
      renderContent || (
        <YStack p="$5">
          <SizableText size="$bodyLg">{tooltip}</SizableText>
        </YStack>
      ),
    [renderContent, tooltip],
  );

  return (
    <LazyPopoverFrame
      placement={placement}
      title={title}
      renderTrigger={triggerMemo}
      renderContent={contentMemo}
    />
  );
}

export const LazyPopover = Object.assign(LazyPopoverFrame, {
  Tooltip: LazyPopoverTooltip,
});

export type { IPopoverProps };
