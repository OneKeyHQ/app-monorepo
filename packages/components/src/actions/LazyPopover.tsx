import { useCallback, useEffect, useMemo, useState } from 'react';

import { SizableText, YStack } from '../primitives';

import { IconButton } from './IconButton';
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

export function preloadLazyPopover() {
  return loadPopover();
}

function LazyPopoverFrame(props: IPopoverProps) {
  const { renderTrigger, open, onOpenChange, trackID } = props;
  const [PopoverComponent, setPopoverComponent] = useState<
    ILazyPopoverComponent | undefined
  >(() => loadedPopover);
  const [localOpen, setLocalOpen] = useState(false);
  const isControlled = typeof open !== 'undefined';
  const actualOpen = isControlled ? open : localOpen;

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
          setPopoverComponent(() => Component);
          if (nextOpen !== undefined) {
            handleOpenChange(nextOpen);
          }
        })
        .catch((error: Error) => {
          console.error('Failed to load Popover:', error);
        });
    },
    [handleOpenChange],
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
