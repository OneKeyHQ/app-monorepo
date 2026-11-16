import { memo, useCallback, useEffect, useId, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Icon, Popover, SizableText, XStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { usePrewarmPerpsTokenSelectorImages } from '../../hooks';

import {
  DESKTOP_TOKEN_SELECTOR_PANEL_WIDTH,
  PerpTokenSelectorContent,
} from './PerpTokenSelector';

import type { IPerpTokenSelection } from './PerpTokenSelector';
import type { IPerpsChartInstrumentDisplay } from '../../hooks/usePerpsChartInstrument';

/**
 * Compact token picker for a chart's controls row. With `onSelectToken` the
 * pick goes to the caller; without it the picker switches the trade
 * instrument, like the ticker bar's.
 */
export const PerpChartTokenSelector = memo(
  ({
    display,
    onSelectToken,
    testID,
  }: {
    display: IPerpsChartInstrumentDisplay;
    onSelectToken?: (selection: IPerpTokenSelection) => void | Promise<void>;
    testID?: string;
  }) => {
    const intl = useIntl();
    const actions = useHyperliquidActions();
    const prewarmTokenSelectorImages = usePrewarmPerpsTokenSelectorImages();
    const [isOpen, setIsOpen] = useState(false);
    const [contentGeneration, setContentGeneration] = useState(0);
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
          <PerpTokenSelectorContent
            key={contentGeneration}
            onSelectToken={onSelectToken}
          />
        }
      />
    );
  },
);

PerpChartTokenSelector.displayName = 'PerpChartTokenSelector';
