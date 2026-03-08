import {
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Icon,
  IconButton,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import { EEarnLabels } from '@onekeyhq/shared/types/staking';
import type {
  IBorrowAlert,
  IEarnText,
  IEarnTooltip,
} from '@onekeyhq/shared/types/staking';

import { EarnActionIcon } from '../../Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
import { PendingIndicator } from '../../Staking/components/StakingActivityIndicator';
import {
  buildBorrowTag,
  isBorrowTag,
  parseBorrowTag,
} from '../../Staking/utils/utils';
import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';
import { useBorrowHealthFactor } from '../hooks/useBorrowHealthFactor';
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
  isLoading,
}: {
  title: IEarnText;
  text?: IEarnText;
  action?: React.ReactNode;
  tooltip?: IEarnTooltip | React.ReactNode;
  needDivider?: boolean;
  isLoading?: boolean;
}) => {
  return (
    <>
      <YStack gap="$1" flexShrink={0}>
        <EarnText text={title} size="$bodyMd" color="$textSubdued" />
        <XStack gap="$2" ai="center">
          {isLoading ? (
            <Skeleton w={60} h="$6" borderRadius="$2" />
          ) : (
            <>
              {text ? (
                <EarnText text={text} size="$headingLg" color="$textText" />
              ) : null}
              {isValidElement(tooltip) ? (
                tooltip
              ) : (
                <EarnTooltip tooltip={tooltip as IEarnTooltip} />
              )}
              {action}
            </>
          )}
        </XStack>
      </YStack>
      {needDivider ? (
        <Divider bg="$headingSm" vertical mx="$6" height="$8" width="$1" />
      ) : null}
    </>
  );
};

export const Overview = ({
  showBottomSpacing = true,
  isActive = true,
  onHealthFactorAlertsChange,
}: {
  showBottomSpacing?: boolean;
  isActive?: boolean;
  onHealthFactorAlertsChange?: (alerts?: IBorrowAlert[]) => void;
}) => {
  const { reserves, market, earnAccount, pendingTxs, setRefreshAllBorrowData } =
    useBorrowContext();
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const amountPlaceholder = useMemo(() => {
    return `${settings.currencyInfo.symbol}0.00`;
  }, [settings.currencyInfo.symbol]);
  const provider = market?.provider;
  const networkId = market?.networkId;
  const marketAddress = market?.marketAddress;
  const earnAccountData = earnAccount.data;
  const earnAccountId =
    earnAccountData?.accountId ?? earnAccountData?.account?.id;

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

  // Calculate pending count and claim IDs from pending transactions
  const pendingCount = pendingTxs.length;
  const pendingClaimIds = useMemo(
    () =>
      pendingTxs
        .filter((tx) => tx.stakingInfo.label === EEarnLabels.Claim)
        .flatMap((tx) => {
          const tags = tx.stakingInfo.tags ?? [];
          return tags.flatMap((tag) => {
            if (isBorrowTag(tag)) {
              const parsed = parseBorrowTag(tag);
              return parsed?.claimIds ?? [];
            }
            return [];
          });
        }),
    [pendingTxs],
  );

  // Fetch health factor separately with 30s polling
  const {
    healthFactorData,
    isLoading: isHealthFactorLoading,
    refresh: refreshHealthFactor,
  } = useBorrowHealthFactor({
    networkId,
    provider,
    marketAddress,
    accountId: earnAccountId,
    enabled:
      isActive && !!(networkId && provider && marketAddress && earnAccountId),
  });
  const healthFactorAlerts = healthFactorData?.alerts;

  useEffect(() => {
    onHealthFactorAlertsChange?.(healthFactorAlerts);
  }, [healthFactorAlerts, onHealthFactorAlertsChange]);

  const {
    borrowRewards,
    isLoading: isRewardsLoading,
    refresh: refreshBorrowRewards,
  } = useBorrowRewards({
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

  const refreshReserves = reserves.refresh;
  const refreshBorrowData = useCallback(async () => {
    const tasks: Array<Promise<void>> = [];
    tasks.push(refreshReserves());
    tasks.push(refreshBorrowRewards(), refreshHealthFactor());
    await Promise.all(tasks);
  }, [refreshBorrowRewards, refreshHealthFactor, refreshReserves]);

  const requestRefresh = useCallback(
    async (_reason: 'manual' | 'txSuccess') => {
      setIsManualRefreshing(true);
      try {
        await refreshBorrowData();
      } finally {
        setIsManualRefreshing(false);
      }
    },
    [refreshBorrowData],
  );

  const refreshBorrowDataForPending = useCallback(
    () => requestRefresh('txSuccess'),
    [requestRefresh],
  );

  useEffect(() => {
    setRefreshAllBorrowData(refreshBorrowDataForPending);
    return () => {
      setRefreshAllBorrowData(() => Promise.resolve());
    };
  }, [refreshBorrowDataForPending, setRefreshAllBorrowData]);

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
    const pendingIdSet = new Set(pendingClaimIds);
    const allIds: string[] = [];
    for (const group of claimableGroups) {
      for (const item of group.items) {
        if (!pendingIdSet.has(item.id)) {
          allIds.push(item.id);
        }
      }
    }

    showBorrowClaimRewardsDialog({
      rewardsDetails,
      pendingClaimIds,
      onClaimItem: async (item) => {
        // Build stakingInfo with proper tag for single item claim
        const stakingInfo = {
          label: EEarnLabels.Claim,
          protocol: earnUtils.getEarnProviderName({ providerName: provider }),
          protocolLogoURI: market?.logoURI,
          tags: [
            EEarnLabels.Borrow,
            buildBorrowTag({
              provider,
              action: 'claim',
              claimIds: [item.id],
            }),
          ],
        };
        await handleBorrowClaim({
          provider,
          marketAddress,
          ids: [item.id],
          stakingInfo,
          onSuccess: () => requestRefresh('txSuccess'),
        });
      },
      onClaimAll: async () => {
        if (allIds.length === 0) {
          return;
        }
        // Build stakingInfo with proper tag for all items claim
        const stakingInfo = {
          label: EEarnLabels.Claim,
          protocol: earnUtils.getEarnProviderName({ providerName: provider }),
          protocolLogoURI: market?.logoURI,
          tags: [
            EEarnLabels.Borrow,
            buildBorrowTag({
              provider,
              action: 'claim',
              claimIds: allIds,
            }),
          ],
        };
        await handleBorrowClaim({
          provider,
          marketAddress,
          ids: allIds,
          stakingInfo,
          onSuccess: () => requestRefresh('txSuccess'),
        });
      },
    });
  }, [
    borrowRewards?.button,
    provider,
    marketAddress,
    networkId,
    earnAccountId,
    market?.logoURI,
    handleBorrowClaim,
    pendingClaimIds,
    requestRefresh,
  ]);

  const { gtMd } = useMedia();

  // Mobile layout
  if (!gtMd) {
    return (
      <YStack mt="$2" mb="$5">
        {/* Row 1: Net worth */}
        <XStack ai="flex-start" jc="space-between" mb="$5">
          <YStack>
            <SizableText size="$bodyMdMedium" color="$textText" mb="$1">
              {labels.netWorth}
            </SizableText>
            <XStack ai="center" gap="$3" mb="$1.5">
              <EarnText
                text={
                  reserves.data?.overview?.netWorth ?? {
                    text: amountPlaceholder,
                    color: '$textDisabled',
                  }
                }
                size="$heading3xl"
                color="$textText"
              />
              <IconButton
                icon="RefreshCcwOutline"
                iconSize="$6"
                variant="tertiary"
                size="small"
                loading={reserves.loading || isManualRefreshing}
                onPress={() => requestRefresh('manual')}
              />
            </XStack>
            {reserves.data?.overview?.netApy ? (
              <XStack ai="center" gap="$1">
                <EarnText
                  text={reserves.data.overview.netApy}
                  size="$bodyMdMedium"
                  color="$textText"
                />
                <SizableText size="$bodyMd" color="$textSubdued">
                  {labels.netApy}
                </SizableText>
              </XStack>
            ) : (
              <SizableText size="$bodyMdMedium" color="$textDisabled">
                -
              </SizableText>
            )}
          </YStack>
          <XStack ai="center" gap="$3" pr="$2.5">
            {pendingCount > 0 ? (
              <PendingIndicator
                num={pendingCount}
                onPress={handleHistoryPress}
              />
            ) : null}
            {!reserves.data?.overview?.history?.disabled &&
            pendingCount === 0 ? (
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
            ) : null}
          </XStack>
        </XStack>

        {/* Grid: Health factor + Platform bonus + Claimable rewards */}
        <YStack gap="$4">
          <XStack gap="$6">
            <YStack gap="$1" flex={1}>
              <SizableText size="$bodyMd" color="$textSubdued">
                {labels.healthFactor}
              </SizableText>
              <XStack ai="center" gap="$1">
                {isHealthFactorLoading && !healthFactorData ? (
                  <Skeleton w={60} h="$6" borderRadius="$2" />
                ) : (
                  <>
                    <EarnText
                      text={
                        healthFactorData?.healthFactor?.text ?? {
                          text: '-',
                          color: '$textDisabled',
                        }
                      }
                      size="$headingLg"
                      color="$textText"
                    />
                    {healthFactorData?.healthFactor ? (
                      <XStack mt="$1">
                        <BorrowHealthFactorTooltip
                          detail={
                            healthFactorData.healthFactor.button?.data
                              .healthFactorDetail
                          }
                        />
                      </XStack>
                    ) : null}
                  </>
                )}
              </XStack>
            </YStack>
            <YStack gap="$1" flex={1}>
              <SizableText size="$bodyMd" color="$textSubdued">
                {labels.platformBonus}
              </SizableText>
              <XStack ai="center" gap="$1">
                <EarnText
                  text={
                    reserves.data?.overview?.platformBonus?.totalReceived
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
                    data={reserves.data?.overview?.platformBonus}
                    accountId={earnAccountId}
                    networkId={networkId}
                    provider={provider}
                    marketAddress={marketAddress}
                  />
                </XStack>
              </XStack>
            </YStack>
          </XStack>
          <YStack gap="$1">
            <EarnText
              text={
                borrowRewards?.title ?? {
                  text: intl.formatMessage({
                    id: ETranslations.defi_claimable_rewards,
                  }),
                }
              }
              size="$bodyMd"
              color="$textSubdued"
            />
            <XStack ai="center" gap="$1">
              {isRewardsLoading && !borrowRewards ? (
                <Skeleton w={80} h="$6" borderRadius="$2" />
              ) : (
                <>
                  <EarnText
                    text={
                      borrowRewards?.description ?? {
                        text: amountPlaceholder,
                        color: '$textDisabled',
                      }
                    }
                    size="$headingLg"
                    color="$textText"
                  />
                  {borrowRewards && !borrowRewards.button.disabled ? (
                    <Button
                      p="0"
                      ai="center"
                      size="small"
                      variant="link"
                      onPress={handleShowRewardsDialog}
                    >
                      <EarnText
                        size="$bodyMdMedium"
                        color="$textInfo"
                        text={borrowRewards.button.text}
                      />
                    </Button>
                  ) : null}
                </>
              )}
            </XStack>
          </YStack>
        </YStack>
      </YStack>
    );
  }

  // Desktop layout
  return (
    <XStack mt="$2" mb={showBottomSpacing ? '$10' : undefined} ai="center">
      <OverviewItem
        needDivider
        title={{ text: labels.netWorth }}
        text={
          reserves.data?.overview?.netWorth ?? {
            text: amountPlaceholder,
            color: '$textDisabled',
          }
        }
        action={
          <IconButton
            icon="RefreshCcwOutline"
            variant="tertiary"
            size="small"
            loading={reserves.loading || isManualRefreshing}
            onPress={() => requestRefresh('manual')}
          />
        }
      />

      <OverviewItem
        needDivider
        title={{ text: labels.netApy }}
        text={
          reserves.data?.overview?.netApy ?? {
            text: '-',
            color: '$textDisabled',
          }
        }
      />
      <OverviewItem
        needDivider
        title={{ text: labels.healthFactor }}
        text={
          isHealthFactorLoading && !healthFactorData
            ? undefined
            : (healthFactorData?.healthFactor?.text ?? {
                text: '-',
                color: '$textDisabled',
              })
        }
        isLoading={isHealthFactorLoading ? !healthFactorData : undefined}
        tooltip={
          healthFactorData?.healthFactor ? (
            <BorrowHealthFactorTooltip
              detail={
                healthFactorData.healthFactor.button?.data.healthFactorDetail
              }
            />
          ) : undefined
        }
      />
      <OverviewItem
        needDivider
        title={
          reserves.data?.overview?.platformBonus?.data?.title ?? {
            text: labels.platformBonus,
          }
        }
        text={
          reserves.data?.overview?.platformBonus?.totalReceived.description ?? {
            text: amountPlaceholder,
            color: '$textDisabled',
          }
        }
        tooltip={
          <BorrowBonusTooltip
            data={reserves.data?.overview?.platformBonus}
            accountId={earnAccountId}
            networkId={networkId}
            provider={provider}
            marketAddress={marketAddress}
          />
        }
      />
      <OverviewItem
        title={
          borrowRewards?.title ?? {
            text: intl.formatMessage({
              id: ETranslations.defi_claimable_rewards,
            }),
          }
        }
        text={
          isRewardsLoading && !borrowRewards
            ? undefined
            : (borrowRewards?.description ?? {
                text: amountPlaceholder,
                color: '$textDisabled',
              })
        }
        isLoading={isRewardsLoading ? !borrowRewards : undefined}
        action={
          borrowRewards && !borrowRewards.button.disabled ? (
            <Button
              p="0"
              ai="center"
              size="small"
              variant="link"
              onPress={handleShowRewardsDialog}
            >
              <EarnText
                size="$bodyMdMedium"
                color="$textInfo"
                text={borrowRewards.button.text}
              />
            </Button>
          ) : null
        }
      />

      <XStack ml="auto" ai="center" gap="$3" pr="$2.5">
        {pendingCount > 0 ? (
          <PendingIndicator num={pendingCount} onPress={handleHistoryPress} />
        ) : null}
        {!reserves.data?.overview?.history?.disabled && pendingCount === 0 ? (
          <EarnActionIcon
            actionIcon={reserves.data?.overview?.history}
            onHistory={handleHistoryPress}
          />
        ) : null}
      </XStack>
    </XStack>
  );
};
