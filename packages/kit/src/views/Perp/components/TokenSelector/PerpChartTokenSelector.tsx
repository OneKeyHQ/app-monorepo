import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Icon,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { usePrewarmPerpsTokenSelectorImages } from '../../hooks';

import {
  DESKTOP_TOKEN_SELECTOR_BODY_HEIGHT,
  DESKTOP_TOKEN_SELECTOR_PANEL_WIDTH,
  PerpTokenSelectorContent,
} from './PerpTokenSelector';

import type { IPerpTokenSelection } from './PerpTokenSelector';
import type { IPerpsChartInstrumentDisplay } from '../../hooks/usePerpsChartInstrument';
import type { LayoutChangeEvent } from 'react-native';

// The popover's gap to its trigger and to the window's edges, with a margin.
const POPOVER_CLEARANCE = 8 + 8 + 4;
// Above the list: the search and the tabs; below it: the key hints.
const ESTIMATED_CHROME_HEIGHT = 150;
// The list keeps a few rows in a short window.
const MIN_BODY_HEIGHT = 200;

function fitBodyHeight(height: number) {
  return Math.round(
    Math.min(
      DESKTOP_TOKEN_SELECTOR_BODY_HEIGHT,
      Math.max(MIN_BODY_HEIGHT, height),
    ),
  );
}

// The list sized so the whole popover fits `space`.
function PerpChartTokenSelectorContent({
  onSelectToken,
  space,
}: {
  onSelectToken: (selection: IPerpTokenSelection) => void;
  space: number;
}) {
  const [bodyHeight, setBodyHeight] = useState(() =>
    fitBodyHeight(space - ESTIMATED_CHROME_HEIGHT),
  );
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      // Only the list changes height, so one correction lands on the size.
      const overflow = event.nativeEvent.layout.height - space;
      setBodyHeight((current) => fitBodyHeight(current - overflow));
    },
    [space],
  );
  return (
    <YStack onLayout={handleLayout}>
      <PerpTokenSelectorContent
        bodyHeight={bodyHeight}
        onSelectToken={onSelectToken}
      />
    </YStack>
  );
}

/**
 * Token picker in a split-view panel's header. A press on it selects the
 * panel, like any press in the panel, and a pick goes to `onSelectToken`,
 * which selects the panel with that token. The list fits the roomier side of
 * the header, so a panel low on the page gets a shorter list rather than a
 * cut-off one.
 */
export const PerpChartTokenSelector = memo(
  ({
    display,
    onSelectToken,
    testID,
  }: {
    display: IPerpsChartInstrumentDisplay;
    onSelectToken: (selection: IPerpTokenSelection) => void;
    testID?: string;
  }) => {
    const intl = useIntl();
    const actions = useHyperliquidActions();
    const prewarmTokenSelectorImages = usePrewarmPerpsTokenSelectorImages();
    const triggerRef = useRef<IElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [contentGeneration, setContentGeneration] = useState(0);
    const [space, setSpace] = useState(0);
    // The list's live prices depend on the selector subscriptions.
    const selectorOwner = useId();
    useEffect(() => {
      if (!isOpen) return;
      const { setTokenSelectorOpen } = actions.current;
      setTokenSelectorOpen({ owner: selectorOwner, open: true });
      return () => {
        setTokenSelectorOpen({ owner: selectorOwner, open: false });
      };
    }, [actions, isOpen, selectorOwner]);
    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (open) {
          void Promise.resolve().then(() => prewarmTokenSelectorImages());
          // The split view is web only, where the trigger is an element.
          const trigger = triggerRef.current as unknown as Element | null;
          const rect = trigger?.getBoundingClientRect();
          setSpace(
            rect
              ? Math.max(rect.top, window.innerHeight - rect.bottom) -
                  POPOVER_CLEARANCE
              : Number.POSITIVE_INFINITY,
          );
          setContentGeneration((generation) => generation + 1);
        }
        setIsOpen(open);
      },
      [prewarmTokenSelectorImages],
    );
    const close = useCallback(() => setIsOpen(false), []);
    const pageFocused = useIsFocused();
    useEffect(() => {
      if (!pageFocused) close();
    }, [close, pageFocused]);
    useListenTabFocusState(ETabRoutes.Perp, (focused, hiddenByModal) => {
      if (!focused || hiddenByModal) close();
    });
    return (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.dexmarket_select_token,
        })}
        floatingPanelProps={{ width: DESKTOP_TOKEN_SELECTOR_PANEL_WIDTH }}
        open={isOpen}
        onOpenChange={handleOpenChange}
        placement="bottom-start"
        renderTrigger={
          <XStack
            ref={triggerRef}
            testID={testID}
            role="button"
            h={28}
            pl="$1"
            pr="$0.5"
            gap="$1.5"
            flexShrink={0}
            alignItems="center"
            borderRadius="$2"
            cursor="pointer"
            userSelect="none"
            hoverStyle={{ bg: '$bgHover' }}
          >
            <Token
              size="xs"
              borderRadius="$full"
              {...(display.tokenImageUris
                ? { tokenImageUris: display.tokenImageUris }
                : { tokenImageUri: display.tokenImageUri })}
              fallbackIcon="CryptoCoinOutline"
            />
            <SizableText size="$bodyMdMedium" numberOfLines={1}>
              {display.label}
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              size="$4"
              color="$iconSubdued"
            />
          </XStack>
        }
        renderContent={
          <PerpChartTokenSelectorContent
            key={contentGeneration}
            onSelectToken={onSelectToken}
            space={space}
          />
        }
      />
    );
  },
);

PerpChartTokenSelector.displayName = 'PerpChartTokenSelector';
