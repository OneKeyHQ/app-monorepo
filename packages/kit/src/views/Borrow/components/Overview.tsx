import { isValidElement, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Icon,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnText, IEarnTooltip } from '@onekeyhq/shared/types/staking';

import { EarnActionIcon } from '../../Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
import { useEarnAccount } from '../../Staking/hooks/useEarnAccount';
import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';
import { useBorrowHealthFactor } from '../hooks/useBorrowHealthFactor';
import { useBorrowReserves } from '../hooks/useBorrowReserves';
import { useBorrowRewards } from '../hooks/useBorrowRewards';
import { useUniversalBorrowClaim } from '../hooks/useUniversalBorrowHooks';

import { BorrowBonusTooltip } from './BorrowBonusTooltip';
import { showBorrowClaimRewardsDialog } from './BorrowClaimRewardsDialog';
import { BorrowHealthFactorTooltip } from './BorrowHealthFactorTooltip';

const OverviewItem = ({
  title,
  text,
  action,
  tooltip,
  needDivider,
}: {
  title: IEarnText;
  text: IEarnText;
  action?: React.ReactNode;
  tooltip?: IEarnTooltip | React.ReactNode;
  needDivider?: boolean;
}) => {
  return (
    <>
      <YStack gap="$1" flexShrink={0}>
        <EarnText text={title} size="$bodyMd" color="$textSubdued" />
        <XStack gap="$2" ai="center">
          <EarnText text={text} size="$headingLg" color="$textText" />
          {isValidElement(tooltip) ? (
            tooltip
          ) : (
            <EarnTooltip tooltip={tooltip as IEarnTooltip} />
          )}
          {action}
        </XStack>
      </YStack>
      {needDivider ? (
        <Divider bg="$headingSm" vertical mx="$6" height="$8" width="$1" />
      ) : null}
    </>
  );
};

export const Overview = () => {
  const { reserves, market, setReserves, setReservesLoading } =
    useBorrowContext();
  const { fetchReserves } = useBorrowReserves();
  const { earnAccount } = useEarnAccount({
    networkId: market?.networkId,
  });
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();
  const amountPlaceholder = useMemo(() => {
    return `${settings.currencyInfo.symbol}0.00`;
  }, [settings.currencyInfo.symbol]);
  const provider = market?.provider;
  const networkId = market?.networkId;
  const marketAddress = market?.marketAddress;
  const earnAccountId = earnAccount?.account.id;
  const historyLabel = useMemo(
    () => intl.formatMessage({ id: ETranslations.global_history }),
    [intl],
  );
  const labels = useMemo(
    () => ({
      netWorth: intl.formatMessage({ id: ETranslations.defi_net_worth }),
      netApy: intl.formatMessage({ id: ETranslations.defi_net_apy }),
      healthFactor: intl.formatMessage({
        id: ETranslations.defi_health_factor,
      }),
      platformBonus: intl.formatMessage({
        id: ETranslations.defi_platform_bonus,
      }),
    }),
    [intl],
  );

  // Fetch health factor separately with 30s polling
  const { healthFactorData } = useBorrowHealthFactor({
    networkId,
    provider,
    marketAddress,
    accountId: earnAccountId,
    enabled: !!(networkId && provider && marketAddress && earnAccountId),
  });

  const { borrowRewards } = useBorrowRewards({
    networkId,
    provider,
    marketAddress,
    accountId: earnAccountId,
    enabled: !!(networkId && provider && marketAddress && earnAccountId),
  });

  const handleBorrowClaim = useUniversalBorrowClaim({
    networkId: networkId ?? '',
    accountId: earnAccountId ?? '',
  });

  const handleRefresh = useCallback(async () => {
    if (!provider || !networkId || !marketAddress) return;
    setReservesLoading(true);
    try {
      const result = await fetchReserves({
        provider,
        networkId,
        marketAddress,
        accountId: earnAccountId,
      });
      setReserves(result);
    } finally {
      setReservesLoading(false);
    }
  }, [
    fetchReserves,
    setReserves,
    setReservesLoading,
    provider,
    networkId,
    marketAddress,
    earnAccountId,
  ]);

  const handleHistoryPress = useCallback(() => {
    if (!provider || !networkId || !marketAddress || !earnAccountId) return;
    BorrowNavigation.pushToBorrowHistory(navigation, {
      accountId: earnAccountId,
      networkId,
      provider,
      marketAddress,
      title: historyLabel,
    });
  }, [
    navigation,
    provider,
    networkId,
    marketAddress,
    earnAccountId,
    historyLabel,
  ]);

  const handleShowRewardsDialog = useCallback(() => {
    if (
      !borrowRewards?.button ||
      !provider ||
      !marketAddress ||
      !networkId ||
      !earnAccountId
    )
      return;

    const rewardsDetails = borrowRewards.button;
    const claimableGroups = rewardsDetails.data.rewardsDetail.claimable;
    const allIds: string[] = [];
    for (const group of claimableGroups) {
      for (const item of group.items) {
        allIds.push(item.id);
      }
    }

    showBorrowClaimRewardsDialog({
      rewardsDetails,
      onClaimItem: async (item) => {
        await handleBorrowClaim({
          provider,
          marketAddress,
          ids: [item.id],
          onSuccess: handleRefresh,
        });
      },
      onClaimAll: async () => {
        await handleBorrowClaim({
          provider,
          marketAddress,
          ids: allIds,
          onSuccess: handleRefresh,
        });
      },
      onClose: handleRefresh,
    });
  }, [
    borrowRewards?.button,
    provider,
    marketAddress,
    networkId,
    earnAccountId,
    handleBorrowClaim,
    handleRefresh,
  ]);

  const { gtMd } = useMedia();

  // Mobile layout
  if (!gtMd) {
    return (
      <YStack mt="$2" mb="$5" gap="$3">
        {/* Row 1: Net worth */}
        <YStack gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {labels.netWorth}
          </SizableText>
          <EarnText
            text={
              reserves?.overview?.netWorth ?? {
                text: amountPlaceholder,
                color: '$textDisabled',
              }
            }
            size="$headingLg"
            color="$textText"
          />
          {reserves?.overview?.netApy ? (
            <XStack ai="center" gap="$1">
              <EarnText
                text={reserves.overview.netApy}
                size="$headingLg"
                color="$textText"
              />
              <SizableText size="$bodyMd" color="$textSubdued">
                {labels.netApy}
              </SizableText>
            </XStack>
          ) : (
            <SizableText size="$headingLg" color="$textDisabled">
              -
            </SizableText>
          )}
        </YStack>

        {/* Row 2: Health factor + Platform bonus */}
        <XStack gap="$6">
          {healthFactorData?.healthFactor ? (
            <YStack gap="$1" flex={1}>
              <SizableText size="$bodyMd" color="$textSubdued">
                {labels.healthFactor}
              </SizableText>
              <XStack ai="center" gap="$1">
                <EarnText
                  text={
                    healthFactorData.healthFactor.text ?? {
                      text: '-',
                      color: '$textDisabled',
                    }
                  }
                  size="$headingLg"
                  color="$textText"
                />
                <XStack mt="$1">
                  <BorrowHealthFactorTooltip
                    detail={
                      healthFactorData.healthFactor.button?.data
                        .healthFactorDetail
                    }
                  />
                </XStack>
              </XStack>
            </YStack>
          ) : null}
          <YStack gap="$1" flex={1}>
            <SizableText size="$bodyMd" color="$textSubdued">
              {labels.platformBonus}
            </SizableText>
            <XStack ai="center" gap="$1">
              <EarnText
                text={
                  reserves?.overview?.platformBonus?.totalReceived
                    .description ?? {
                    text: amountPlaceholder,
                    color: '$textDisabled',
                  }
                }
                size="$headingLg"
                color="$textText"
              />
              <XStack mt="$1">
                <BorrowBonusTooltip
                  data={reserves?.overview?.platformBonus}
                  accountId={earnAccountId}
                  networkId={networkId}
                  provider={provider}
                  marketAddress={marketAddress}
                />
              </XStack>
            </XStack>
          </YStack>
        </XStack>

        {/* Row 3: Rewards + History */}
        {borrowRewards ? (
          <XStack jc="space-between" ai="flex-start">
            <YStack gap="$1" flex={1}>
              <EarnText
                text={borrowRewards.title}
                size="$bodyMd"
                color="$textSubdued"
              />
              <XStack ai="center" gap="$1">
                <EarnText
                  text={borrowRewards.description}
                  size="$headingLg"
                  color="$textText"
                />
                <Button
                  p="0"
                  ai="center"
                  size="small"
                  variant="link"
                  cursor={
                    borrowRewards.button.disabled ? 'not-allowed' : 'pointer'
                  }
                  disabled={borrowRewards.button.disabled}
                  onPress={handleShowRewardsDialog}
                >
                  <EarnText
                    size="$bodyMdMedium"
                    color="$textInfo"
                    text={borrowRewards.button.text}
                  />
                </Button>
              </XStack>
            </YStack>
            <XStack
              ai="center"
              gap="$1"
              cursor="pointer"
              onPress={handleHistoryPress}
            >
              <Icon
                name="ClockTimeHistoryOutline"
                size="$4"
                color="$iconSubdued"
              />
              <SizableText size="$bodyMd" color="$textSubdued">
                {historyLabel}
              </SizableText>
            </XStack>
          </XStack>
        ) : null}
      </YStack>
    );
  }

  // Desktop layout
  return (
    <XStack mt="$2" mb="$10" ai="center">
      <OverviewItem
        needDivider
        title={{ text: labels.netWorth }}
        text={
          reserves?.overview?.netWorth ?? {
            text: amountPlaceholder,
            color: '$textDisabled',
          }
        }
      />

      <OverviewItem
        needDivider
        title={{ text: labels.netApy }}
        text={
          reserves?.overview?.netApy ?? { text: '-', color: '$textDisabled' }
        }
      />
      {healthFactorData?.healthFactor ? (
        <OverviewItem
          needDivider
          title={{ text: labels.healthFactor }}
          text={
            healthFactorData.healthFactor.text ?? {
              text: amountPlaceholder,
              color: '$textDisabled',
            }
          }
          tooltip={
            <BorrowHealthFactorTooltip
              detail={
                healthFactorData.healthFactor.button?.data.healthFactorDetail
              }
            />
          }
        />
      ) : null}
      <OverviewItem
        needDivider={!!borrowRewards}
        title={
          reserves?.overview?.platformBonus?.data?.title ?? {
            text: labels.platformBonus,
          }
        }
        text={
          reserves?.overview?.platformBonus?.totalReceived.description ?? {
            text: amountPlaceholder,
            color: '$textDisabled',
          }
        }
        tooltip={
          <BorrowBonusTooltip
            data={reserves?.overview?.platformBonus}
            accountId={earnAccountId}
            networkId={networkId}
            provider={provider}
            marketAddress={marketAddress}
          />
        }
      />
      {borrowRewards ? (
        <OverviewItem
          title={borrowRewards?.title}
          text={borrowRewards?.description}
          action={
            <Button
              p="0"
              ai="center"
              size="small"
              variant="link"
              cursor={borrowRewards.button.disabled ? 'not-allowed' : 'pointer'}
              disabled={borrowRewards.button.disabled}
              onPress={handleShowRewardsDialog}
            >
              <EarnText
                size="$bodyMdMedium"
                color="$textInfo"
                text={borrowRewards.button.text}
              />
            </Button>
          }
        />
      ) : null}

      <XStack ml="auto">
        <EarnActionIcon
          actionIcon={reserves?.overview?.history}
          onHistory={handleHistoryPress}
        />
      </XStack>
    </XStack>
  );
};
