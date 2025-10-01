import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  DebugRenderTracker,
  Divider,
  IconButton,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  usePerpsActiveAccountMmrAtom,
  usePerpsActiveAccountSummaryAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { PerpSettingsButton } from '../PerpSettingsButton';
import { PerpTokenSelectorMobile } from '../TokenSelector/PerpTokenSelector';
import { PerpsAccountNumberValue } from '../TradingPanel/components/PerpsAccountNumberValue';

import { TickerBarChange24hPercent } from './PerpTickerBarDesktop';

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
        title="MMR"
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
      <YStack gap="$1">
        <PerpTokenSelectorMobile />
        <TickerBarChange24hPercent />
      </YStack>

      <XStack pt="$0.5" gap="$3" alignItems="center">
        <PerpTickerBarMMRInfoMobile />
        <PerpCandleChartButtonMobile />
        <PerpSettingsButton testID="perp-mobile-settings-button" />
      </XStack>
    </XStack>
  );
  return (
    <DebugRenderTracker name="PerpTickerBarMobile" position="top-right">
      {content}
    </DebugRenderTracker>
  );
}
