import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  DebugRenderTracker,
  Divider,
  IconButton,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePerpsTokenSearchAliasesAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsActiveAccountMmrAtom,
  usePerpsActiveAccountStatusAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsActiveAssetAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
import { getTokenSubtitle } from '@onekeyhq/shared/src/utils/perpsUtils';

import { PerpsActivityCenterAction } from '../PerpsActivityCenterAction';
import { PerpSettingsButton } from '../PerpSettingsButton';
import { PerpTokenSelectorMobile } from '../TokenSelector/PerpTokenSelector';
import { PerpsAccountNumberValue } from '../TradingPanel/components/PerpsAccountNumberValue';

const MOBILE_TICKER_SUBTITLE_MAX_WIDTH = 64;

const PerpTickerBarMMRInfoMobileView = memo(
  ({
    mmrPercent,
    crossMaintenanceMarginUsed,
  }: {
    mmrPercent: string;
    crossMaintenanceMarginUsed: string;
  }) => {
    const intl = useIntl();
    const color = useMemo(
      () => (parseFloat(mmrPercent) <= 50 ? '$green11' : '$red11'),
      [mmrPercent],
    );
    return (
      <Popover
        title={intl.formatMessage({
          id: ETranslations.perp_account_panel_account_maintenance_margin,
        })}
        renderTrigger={
          <DebugRenderTracker name="PerpTickerBarMMRInfoMobileViewTrigger">
            <XStack
              borderRadius="$full"
              alignItems="center"
              gap="$1"
              px="$2"
              borderColor={color}
              borderWidth="$px"
            >
              <SizableText lineHeight={18} fontSize={10} color={color}>
                {mmrPercent}%
              </SizableText>
            </XStack>
          </DebugRenderTracker>
        }
        renderContent={
          <DebugRenderTracker name="PerpTickerBarMMRInfoMobileViewContent">
            <YStack
              bg="$bg"
              justifyContent="center"
              w="100%"
              px="$5"
              pt="$2"
              pb="$5"
              gap="$5"
            >
              <XStack alignItems="center" justifyContent="space-between">
                <YStack w="50%">
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.perp_account_panel_account_maintenance_margin,
                    })}
                  </SizableText>

                  <PerpsAccountNumberValue
                    value={crossMaintenanceMarginUsed}
                    skeletonWidth={70}
                    textSize="$bodyMdMedium"
                  />
                </YStack>
                <YStack w="50%">
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.perp_account_cross_margin_ration,
                    })}
                  </SizableText>
                  <SizableText size="$bodyMdMedium" color={color}>
                    {mmrPercent}%
                  </SizableText>
                </YStack>
              </XStack>

              <Divider />
              <YStack gap="$2">
                <SizableText size="$bodySmMedium">
                  {intl.formatMessage({
                    id: ETranslations.perp_account_panel_account_maintenance_margin_tooltip,
                  })}
                </SizableText>
                <SizableText size="$bodySmMedium">
                  {intl.formatMessage({
                    id: ETranslations.perp_account_cross_margin_ration_tip,
                  })}
                </SizableText>
              </YStack>
            </YStack>
          </DebugRenderTracker>
        }
      />
    );
  },
);
PerpTickerBarMMRInfoMobileView.displayName = 'PerpTickerBarMMRInfoMobileView';

function PerpTickerBarMMRInfoMobile() {
  const [{ mmrPercent }] = usePerpsActiveAccountMmrAtom();
  //   const mmr = 0.3724
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();

  if (!mmrPercent) {
    return null;
  }

  return (
    <PerpTickerBarMMRInfoMobileView
      mmrPercent={mmrPercent}
      crossMaintenanceMarginUsed={
        accountSummary?.crossMaintenanceMarginUsed ?? ''
      }
    />
  );
}

function PerpCandleChartButtonMobile() {
  const navigation = useAppNavigation();

  const onPressCandleChart = useCallback(() => {
    navigation.push(EModalPerpRoutes.MobilePerpMarket);
  }, [navigation]);

  return (
    <DebugRenderTracker name="PerpCandleChartButtonMobile">
      <IconButton
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
  const [builderFeeRate, setBuilderFeeRate] = useState<number | undefined>();
  const [asset] = usePerpsActiveAssetAtom();
  const [tokenSearchAliases] = usePerpsTokenSearchAliasesAtom();
  const [fetchedTokenSearchAliases, setFetchedTokenSearchAliases] = useState<
    ITokenSearchAliases | undefined
  >(undefined);
  const effectiveTokenSearchAliases =
    tokenSearchAliases ?? fetchedTokenSearchAliases;
  const subtitle = useMemo(
    () => getTokenSubtitle(asset?.coin ?? '', effectiveTokenSearchAliases),
    [asset?.coin, effectiveTokenSearchAliases],
  );

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
          {intl.formatMessage({
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
      {builderFeeRate === 0 ? (
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
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();

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
        <PerpTickerBarMMRInfoMobile />
        <PerpsActivityCenterAction size="small" copyAsUrl />
        <PerpCandleChartButtonMobile />
        <PerpSettingsButton
          testID="perp-mobile-settings-button"
          showFeeTierEntry={!perpsAccountStatus.accountNotSupport}
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
