import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  DebugRenderTracker,
  IconButton,
  Popover,
  SizableText,
  XStack,
  YStack,
  useIsSplitMainActive,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePerpsTokenSearchAliasesAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import { useTradingModeAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
import { getTokenSubtitle } from '@onekeyhq/shared/src/utils/perpsUtils';

import { useActiveTradeDisplay } from '../../hooks/useActiveTradeDisplay';
import { PerpTestIDs } from '../../testIDs';
import { PerpsActivityCenterAction } from '../PerpsActivityCenterAction';
import { PerpSettingsButton } from '../PerpSettingsButton';
import { PerpTokenSelectorMobile } from '../TokenSelector/PerpTokenSelector';

const MOBILE_TICKER_SUBTITLE_MAX_WIDTH = 64;

function PerpCandleChartButtonMobile() {
  const navigation = useAppNavigation();
  const isSplitMainActive = useIsSplitMainActive();

  const onPressCandleChart = useCallback(() => {
    navigation.push(EModalPerpRoutes.MobilePerpMarket);
  }, [navigation]);

  // The chart is already rendered alongside this form in the sub pane —
  // tapping the icon would push another instance on top of MAIN's stack.
  if (isSplitMainActive) {
    return null;
  }

  return (
    <DebugRenderTracker name="PerpCandleChartButtonMobile">
      <IconButton
        testID={PerpTestIDs.CandleChartButton}
        icon="TradingViewCandlesOutline"
        size="small"
        iconProps={{ color: '$iconSubdued' }}
        variant="tertiary"
        onPress={onPressCandleChart}
      />
    </DebugRenderTracker>
  );
}

function PerpBadgesRow() {
  const intl = useIntl();
  const [tradingMode] = useTradingModeAtom();
  const isSpot = tradingMode === 'spot';
  const [builderFeeRate, setBuilderFeeRate] = useState<number | undefined>();
  const { baseName, rawBaseName, coin } = useActiveTradeDisplay();
  const [tokenSearchAliases] = usePerpsTokenSearchAliasesAtom();
  const [fetchedTokenSearchAliases, setFetchedTokenSearchAliases] = useState<
    ITokenSearchAliases | undefined
  >(undefined);
  const effectiveTokenSearchAliases =
    tokenSearchAliases ?? fetchedTokenSearchAliases;
  const subtitle = useMemo(() => {
    if (isSpot) {
      // Match the dual-lookup pattern in token selectors: server aliases may
      // be keyed by display name or raw baseName.
      return (
        getTokenSubtitle(baseName, effectiveTokenSearchAliases) ??
        getTokenSubtitle(rawBaseName, effectiveTokenSearchAliases)
      );
    }
    return getTokenSubtitle(coin, effectiveTokenSearchAliases);
  }, [isSpot, baseName, rawBaseName, coin, effectiveTokenSearchAliases]);

  // Fetch builder fee once on mount (independent of alias state)
  useEffect(() => {
    void backgroundApiProxy.simpleDb.perp.getPerpData().then((config) => {
      setBuilderFeeRate(config.hyperliquidMaxBuilderFee);
    });
  }, []);

  // Fetch token aliases only when not yet available
  useEffect(() => {
    if (effectiveTokenSearchAliases !== undefined) {
      return;
    }
    let isCancelled = false;
    void (async () => {
      const config = await backgroundApiProxy.simpleDb.perp.getPerpData();
      if (isCancelled) {
        return;
      }
      if (config.tokenSearchAliases !== undefined) {
        setFetchedTokenSearchAliases(config.tokenSearchAliases);
        return;
      }
      const aliases =
        await backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases();
      if (!isCancelled) {
        setFetchedTokenSearchAliases(aliases);
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [effectiveTokenSearchAliases]);

  return (
    <XStack alignItems="center" gap="$1.5">
      <Badge radius="$1" bg="$bgSubdued" px="$1" py={0}>
        <SizableText color="$textSubdued" fontSize={10}>
          {isSpot
            ? intl.formatMessage({
                id: ETranslations.dexmarket_spot,
              })
            : intl.formatMessage({
                id: ETranslations.perp_label_perp,
              })}
        </SizableText>
      </Badge>
      {subtitle ? (
        <Popover
          title={intl.formatMessage({
            id: ETranslations.perps_token_alias,
          })}
          renderTrigger={
            <Badge
              radius="$1"
              bg="$bgInfo"
              px="$1"
              py={0}
              maxWidth={MOBILE_TICKER_SUBTITLE_MAX_WIDTH}
              minWidth={0}
              overflow="hidden"
            >
              <SizableText
                color="$textInfo"
                fontSize={10}
                numberOfLines={1}
                ellipsizeMode="tail"
                flexShrink={1}
              >
                {subtitle}
              </SizableText>
            </Badge>
          }
          renderContent={
            <YStack px="$5" pb="$4">
              <SizableText size="$bodyLg" color="$text">
                {subtitle}
              </SizableText>
            </YStack>
          }
        />
      ) : null}
      {!isSpot && builderFeeRate === 0 ? (
        <Badge radius="$1" bg="$bgSuccess" px="$0.5" py={0}>
          <SizableText color="$textSuccess" fontSize={10}>
            {intl.formatMessage({
              id: ETranslations.perp_0_fee,
            })}
          </SizableText>
        </Badge>
      ) : null}
    </XStack>
  );
}

export function PerpTickerBarMobile() {
  const content = (
    <XStack
      flex={1}
      bg="$bgApp"
      gap="$4"
      px="$4"
      pt="$2"
      pb="$1.5"
      alignItems="flex-start"
      justifyContent="space-between"
    >
      <YStack>
        <PerpTokenSelectorMobile />
        <PerpBadgesRow />
      </YStack>

      <XStack pt="$0.5" gap="$3" alignItems="center">
        <PerpsActivityCenterAction size="small" copyAsUrl />
        <PerpCandleChartButtonMobile />
        <PerpSettingsButton
          testID={PerpTestIDs.MobileSettingsButton}
          showGuideEntry
        />
      </XStack>
    </XStack>
  );
  return (
    <DebugRenderTracker name="PerpTickerBarMobile" position="top-right">
      {content}
    </DebugRenderTracker>
  );
}
