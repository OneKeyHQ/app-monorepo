import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  NumberSizeableText,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useEarnAtom } from '../../../states/jotai/contexts/earn';
import { useEarnAccountKey } from '../hooks/useEarnAccountKey';
import { EarnTestIDs } from '../testIDs';
import { getNumberColor } from '../utils/getNumberColor';

const OverviewComponent = ({
  isLoading,
  onRefresh,
  displayTotalFiatValue,
  displayEarnings24h,
  onPressTotalValue,
}: {
  isLoading: boolean;
  onRefresh: () => void;
  displayTotalFiatValue?: string;
  displayEarnings24h?: string;
  onPressTotalValue?: () => void;
}) => {
  const totalFiatMapKey = useEarnAccountKey();
  const [{ earnAccount }] = useEarnAtom();
  const [settings] = useSettingsPersistAtom();
  const rawTotalFiatValue = useMemo(
    () => earnAccount?.[totalFiatMapKey]?.totalFiatValue || '0',
    [earnAccount, totalFiatMapKey],
  );
  const totalFiatValue = displayTotalFiatValue ?? rawTotalFiatValue;
  const rawEarnings24h = useMemo(
    () => earnAccount?.[totalFiatMapKey]?.earnings24h || '0',
    [earnAccount, totalFiatMapKey],
  );
  const earnings24h = displayEarnings24h ?? rawEarnings24h;
  const intl = useIntl();

  const handleRefresh = useCallback(() => {
    onRefresh();
  }, [onRefresh]);

  return (
    <YStack
      testID={EarnTestIDs.portfolioOverview}
      gap={8}
      px="$0"
      flex={1}
      $gtLg={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '$8',
      }}
    >
      {/* total value */}
      <YStack gap="$1.5" flexShrink={1}>
        <SizableText
          size="$bodyLgMedium"
          $gtLg={{
            pl: '$0.5',
          }}
          pointerEvents="box-none"
        >
          {intl.formatMessage({ id: ETranslations.earn_total_staked_value })}
        </SizableText>
        <XStack
          testID={onPressTotalValue ? EarnTestIDs.portfolioEntry : undefined}
          role={onPressTotalValue ? 'button' : undefined}
          gap="$3"
          ai="center"
          alignSelf="flex-start"
          cursor={onPressTotalValue ? 'pointer' : undefined}
          onPress={onPressTotalValue}
        >
          <NumberSizeableText
            size="$heading5xl"
            fontWeight={400}
            formatter="value"
            color={getNumberColor(totalFiatValue, '$text')}
            formatterOptions={{ currency: settings.currencyInfo.symbol }}
            numberOfLines={1}
            pointerEvents="box-none"
          >
            {totalFiatValue}
          </NumberSizeableText>
          {onPressTotalValue ? (
            <Icon
              name="ChevronRightSmallOutline"
              size="$8"
              color="$iconSubdued"
              pointerEvents="none"
            />
          ) : (
            <IconButton
              testID="earn-icon-btn"
              icon="RefreshCcwOutline"
              variant="tertiary"
              loading={isLoading}
              onPress={handleRefresh}
            />
          )}
        </XStack>
      </YStack>
      {/* 24h earnings */}
      <XStack
        gap="$1.5"
        flexShrink={1}
        $gtLg={{
          flexDirection: 'column-reverse',
        }}
      >
        <NumberSizeableText
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
            showPlusMinusSigns: Number(earnings24h) !== 0,
          }}
          size="$bodyMdMedium"
          color={getNumberColor(earnings24h)}
          numberOfLines={1}
          $gtLg={{
            size: '$heading5xl',
            fontWeight: 400,
          }}
          pointerEvents="box-none"
        >
          {earnings24h}
        </NumberSizeableText>
        <XStack gap="$1.5" alignItems="center">
          <SizableText
            size="$bodyMdMedium"
            color="$textSubdued"
            $gtLg={{
              pl: '$0.5',
              color: '$text',
              size: '$bodyLgMedium',
            }}
            pointerEvents="box-none"
          >
            {intl.formatMessage({ id: ETranslations.earn_24h_earnings })}
          </SizableText>
          <Popover
            placement="bottom-start"
            renderTrigger={
              <IconButton
                testID="earn-icon-btn"
                variant="tertiary"
                size="small"
                icon="InfoCircleOutline"
              />
            }
            title={intl.formatMessage({
              id: ETranslations.earn_24h_earnings,
            })}
            renderContent={
              <SizableText px="$pagePadding" py="$4">
                {intl.formatMessage({
                  id: ETranslations.earn_24h_earnings_tooltip,
                })}
              </SizableText>
            }
          />
        </XStack>
      </XStack>
    </YStack>
  );
};

export const Overview = memo(OverviewComponent);
