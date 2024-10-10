import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Icon, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

type IStakingListItemProps = {
  networkId: string;
  accountId: string;
  tokenAddress: string;
  indexedAccountId?: string;
};

const StakingEntryListItemContent = ({
  aprValue,
  onPress,
  primaryTitle,
}: {
  aprValue?: string | number;
  onPress?: () => void;
  primaryTitle?: string;
}) => {
  const intl = useIntl();
  const primary =
    primaryTitle ||
    intl.formatMessage({
      id: ETranslations.earn_stake_and_earn,
    });
  return (
    <>
      <ListItem
        drillIn
        onPress={onPress}
        py="$3"
        px="$5"
        mx="$0"
        bg="$bgSuccessSubdued"
        hoverStyle={{ bg: '$bgSuccess' }}
        pressStyle={{ bg: '$bgSuccess' }}
        borderTopWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$0"
      >
        <Stack p="$3" borderRadius="$full" bg="$bgSuccess">
          <Icon name="CoinsOutline" color="$iconSuccess" />
        </Stack>
        <ListItem.Text
          flex={1}
          userSelect="none"
          cursor="default"
          primary={primary}
          secondary={
            aprValue && Number(aprValue) > 0
              ? intl.formatMessage(
                  { id: ETranslations.earn_up_to_number_in_annual_rewards },
                  { number: `${aprValue}%` },
                )
              : undefined
          }
          secondaryTextProps={{
            size: '$bodyMdMedium',
            color: '$textSuccess',
            userSelect: 'none',
          }}
        />
      </ListItem>
    </>
  );
};

const StakingEntryListItem = ({
  networkId,
  accountId,
  symbol,
  aprValue,
  indexedAccountId,
}: IStakingListItemProps & { symbol: string; aprValue: string }) => {
  const navigation = useAppNavigation();
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.AssetProtocolList,
      params: { networkId, accountId, symbol, indexedAccountId, filter: true },
    });
  }, [navigation, networkId, accountId, symbol, indexedAccountId]);
  const intl = useIntl();
  return (
    <StakingEntryListItemContent
      primaryTitle={
        networkUtils.isBTCNetwork(networkId)
          ? intl.formatMessage({
              id: ETranslations.earn_stake_in_babylon_ecosystem,
            })
          : undefined
      }
      aprValue={aprValue}
      onPress={onPress}
    />
  );
};

export const TokenDetailStakingEntry = ({
  networkId,
  accountId,
  tokenAddress,
  indexedAccountId,
}: IStakingListItemProps) => {
  const { result } = usePromiseResult(async () => {
    const symbolInfo =
      await backgroundApiProxy.serviceStaking.findSymbolByTokenAddress({
        networkId,
        tokenAddress,
      });
    if (!symbolInfo) {
      return undefined;
    }
    const protocolList =
      await backgroundApiProxy.serviceStaking.getProtocolList({
        symbol: symbolInfo?.symbol,
        networkId,
        filter: true,
      });
    const aprItems = protocolList
      .map((o) => Number(o.provider.apr))
      .filter((n) => Number(n) > 0);
    const maxApr = Math.max(0, ...aprItems);
    return { symbolInfo, maxApr };
  }, [networkId, tokenAddress]);
  if (result) {
    return (
      <StakingEntryListItem
        networkId={networkId}
        accountId={accountId}
        tokenAddress={tokenAddress}
        indexedAccountId={indexedAccountId}
        symbol={result.symbolInfo.symbol}
        aprValue={String(result.maxApr)}
      />
    );
  }
  return null;
};
