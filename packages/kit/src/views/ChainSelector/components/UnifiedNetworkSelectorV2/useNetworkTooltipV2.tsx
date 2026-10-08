import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Popover,
  SizableText,
  Stack,
  Tooltip,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  ActionAnchorInvalidatedEvent,
  NativeListActionAnchor,
  NativeListRef,
  RowActionEvent,
} from '@onekeyfe/react-native-native-list';
import type { View } from 'react-native';

type INetworkTooltipV2 = {
  anchor: NativeListActionAnchor;
  left: number;
  top: number;
  message: string;
  isEdit: boolean;
};

export function useNetworkTooltipV2(listRef: RefObject<NativeListRef | null>) {
  const intl = useIntl();
  const containerRef = useRef<View>(null);
  const activeTokenRef = useRef<string | undefined>(undefined);
  const [tooltip, setTooltip] = useState<INetworkTooltipV2>();

  const closeTooltip = useCallback(() => {
    const token = activeTokenRef.current;
    activeTokenRef.current = undefined;
    if (token) {
      listRef.current?.setActionAnchorState({ token, open: false });
    }
    setTooltip(undefined);
  }, [listRef]);

  useEffect(
    () => () => {
      const token = activeTokenRef.current;
      if (token) listRef.current?.setActionAnchorState({ token, open: false });
    },
    [listRef],
  );

  const showTooltip = useCallback(
    (event: RowActionEvent) => {
      const isEdit = event.actionKey === 'network.tooltip.edit';
      let translation = ETranslations.network_selection_performance_tip;
      if (isEdit) {
        translation = ETranslations.global_edit;
      } else if (event.actionKey === 'network.tooltip.assets') {
        translation = ETranslations.network_auto_detection_tip;
      }
      const { anchor } = event;
      if (!anchor) return;
      closeTooltip();
      activeTokenRef.current = anchor.token;
      listRef.current?.setActionAnchorState({
        token: anchor.token,
        open: true,
      });
      containerRef.current?.measureInWindow((x, y) => {
        if (activeTokenRef.current !== anchor.token) return;
        setTooltip({
          anchor,
          left: anchor.windowRect.x - x,
          top: anchor.windowRect.y - y,
          message: intl.formatMessage({ id: translation }),
          isEdit,
        });
      });
    },
    [closeTooltip, intl, listRef],
  );

  const onActionAnchorInvalidated = useCallback(
    (event: ActionAnchorInvalidatedEvent) => {
      if (activeTokenRef.current === event.token) closeTooltip();
    },
    [closeTooltip],
  );

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeTooltip();
    },
    [closeTooltip],
  );

  const tooltipElement = tooltip ? (
    <Stack
      position="absolute"
      left={tooltip.left}
      top={tooltip.top}
      width={tooltip.anchor.windowRect.width}
      height={tooltip.anchor.windowRect.height}
      pointerEvents="box-none"
    >
      {platformEnv.isNative ? (
        <Popover
          open
          onOpenChange={onOpenChange}
          title=""
          showHeader={false}
          placement="bottom-start"
          renderTrigger={
            <Stack
              width={tooltip.anchor.windowRect.width}
              height={tooltip.anchor.windowRect.height}
              pointerEvents="none"
            />
          }
          renderContent={
            <YStack p="$5">
              <SizableText size="$bodyLg">{tooltip.message}</SizableText>
            </YStack>
          }
        />
      ) : (
        <Tooltip
          open
          triggerAsChild
          onOpenChange={onOpenChange}
          placement={tooltip.isEdit ? 'top' : 'bottom-start'}
          {...(tooltip.isEdit ? { offset: 12 } : undefined)}
          renderTrigger={
            <Stack
              width={tooltip.anchor.windowRect.width}
              height={tooltip.anchor.windowRect.height}
              pointerEvents="none"
            />
          }
          renderContent={tooltip.message}
        />
      )}
    </Stack>
  ) : null;

  return {
    containerRef,
    showTooltip,
    closeTooltip,
    onActionAnchorInvalidated,
    tooltipElement,
  };
}
