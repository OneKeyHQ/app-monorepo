import { useCallback, useMemo } from 'react';

import { Divider, XStack, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IEarnText, IEarnTooltip } from '@onekeyhq/shared/types/staking';

import { EarnActionIcon } from '../../Staking/components/ProtocolDetails/EarnActionIcon';
import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';
import { useBorrowReserves } from '../hooks/useBorrowReserves';
import { useEarnAccount } from '../hooks/useEarnAccount';

import { BorrowAction } from './BorrowAction';

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
  tooltip?: IEarnTooltip;
  needDivider?: boolean;
}) => {
  return (
    <>
      <YStack gap="$1">
        <EarnText text={title} size="$bodyMd" color="$textSubdued" />
        <XStack gap="$2">
          <EarnText text={text} size="$headingLg" color="$textText" />
          <EarnTooltip tooltip={tooltip} />
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
  const { reserves, market, setReserves } = useBorrowContext();
  const { fetchReserves } = useBorrowReserves();
  const { earnAccount } = useEarnAccount({
    networkId: market?.networkId,
  });
  const [settings] = useSettingsPersistAtom();
  const navigation = useAppNavigation();
  const amountPlaceholder = useMemo(() => {
    return `${settings.currencyInfo.symbol}0.00`;
  }, [settings.currencyInfo.symbol]);
  const claimAction = useMemo(
    () => reserves?.overview?.rewards.button,
    [reserves?.overview?.rewards],
  );
  const provider = market?.provider;
  const networkId = market?.networkId;
  const marketAddress = market?.marketAddress;
  const providerLogoURI = market?.logoURI;
  const earnAccountId = earnAccount?.account.id;

  const handleRefresh = useCallback(async () => {
    if (!provider || !networkId || !marketAddress || !earnAccountId) return;
    const result = await fetchReserves({
      provider,
      networkId,
      marketAddress,
      accountId: earnAccountId,
    });
    setReserves(result);
  }, [
    fetchReserves,
    setReserves,
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
          reserves?.overview?.healthFactor?.text ?? {
            text: amountPlaceholder,
            color: '$textDisabled',
          }
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
      />
      <OverviewItem
        title={{ text: 'Claimable rewards' }} // FIXME[borrow]: i18n
        text={
          reserves?.overview?.rewards.text ?? {
            text: amountPlaceholder,
            color: '$textDisabled',
          }
        }
        action={
          <BorrowAction
            action={claimAction}
            accountId={earnAccountId}
            networkId={networkId}
            provider={provider}
            providerLogoURI={providerLogoURI}
            symbol={claimAction?.data?.token?.info.symbol ?? 'USDC'}
            onSuccess={handleRefresh}
          />
        }
      />

      <XStack ml="auto">
        <EarnActionIcon
          actionIcon={reserves?.overview?.history}
          onHistory={handleHistoryPress}
        />
      </XStack>
    </XStack>
  );
};
