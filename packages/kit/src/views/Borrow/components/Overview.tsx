import { isValidElement, useCallback, useMemo } from 'react';

import { Button, Divider, XStack, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IEarnRewardsDetails,
  IEarnText,
  IEarnTooltip,
} from '@onekeyhq/shared/types/staking';

import { EarnActionIcon } from '../../Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';
import { useBorrowHealthFactor } from '../hooks/useBorrowHealthFactor';
import { useBorrowReserves } from '../hooks/useBorrowReserves';
import { useBorrowRewards } from '../hooks/useBorrowRewards';
import { useEarnAccount } from '../hooks/useEarnAccount';
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
        <XStack gap="$2">
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
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();
  const amountPlaceholder = useMemo(() => {
    return `${settings.currencyInfo.symbol}0.00`;
  }, [settings.currencyInfo.symbol]);
  const provider = market?.provider;
  const networkId = market?.networkId;
  const marketAddress = market?.marketAddress;
  const earnAccountId = earnAccount?.account.id;

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
    if (!provider || !networkId || !marketAddress || !earnAccountId) return;
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
      title: 'Borrow History', // FIXME[borrow]: i18n
    });
  }, [navigation, provider, networkId, marketAddress, earnAccountId]);

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

  // FIXME[borrow]: i18n

  return (
    <XStack mt="$2" mb="$10" ai="center">
      <OverviewItem
        needDivider
        title={{ text: 'Net worth' }} // FIXME[borrow]: i18n
        text={
          reserves?.overview?.netWorth ?? {
            text: amountPlaceholder,
            color: '$textDisabled',
          }
        }
      />

      <OverviewItem
        needDivider
        title={{ text: 'Net APY' }} // FIXME[borrow]: i18n
        text={
          reserves?.overview?.netApy ?? { text: '-', color: '$textDisabled' }
        }
      />
      <OverviewItem
        needDivider
        title={{ text: 'Health factor' }} // FIXME[borrow]: i18n
        text={
          healthFactorData?.healthFactor?.text ?? {
            text: amountPlaceholder,
            color: '$textDisabled',
          }
        }
        tooltip={
          <BorrowHealthFactorTooltip
            detail={
              healthFactorData?.healthFactor?.button?.data.healthFactorDetail
            }
          />
        }
      />
      <OverviewItem
        needDivider
        title={
          reserves?.overview?.platformBonus?.data?.title ?? {
            text: 'Platform bonus',
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
            handleHistoryPress={handleHistoryPress}
          />
        }
      />
      {borrowRewards ? (
        <OverviewItem
          title={borrowRewards?.title} // FIXME[borrow]: i18n
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
