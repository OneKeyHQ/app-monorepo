import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { Icon, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EthereumMatic,
  SepoliaMatic,
} from '@onekeyhq/shared/src/consts/addresses';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';

type IStakingListItemProps = {
  networkId: string;
  accountId: string;
  tokenAddress: string;
};

const StakingAprAd = ({
  aprValue,
  onPress,
}: {
  aprValue: string | number;
  onPress: () => void;
}) => {
  const intl = useIntl();
  return (
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
        <Icon name="ChartColumnar3Outline" color="$iconSuccess" />
      </Stack>
      <ListItem.Text
        flex={1}
        primary={intl.formatMessage({ id: ETranslations.earn_stake_and_earn })}
        secondary={intl.formatMessage(
          { id: ETranslations.earn_up_to_number_in_annual_rewards },
          { number: `${aprValue}%` },
        )}
        secondaryTextProps={{
          size: '$bodyMdMedium',
          color: '$textSuccess',
        }}
      />
    </ListItem>
  );
};

const MaticStakingAprAd = ({ networkId, accountId }: IStakingListItemProps) => {
  const navigation = useAppNavigation();
  const { result } = usePromiseResult(
    () => backgroundApiProxy.serviceStaking.getApr('matic'),
    [],
  );
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.MaticLidoOverview,
      params: { networkId, accountId },
    });
  }, [navigation, networkId, accountId]);
  if (!result) {
    return null;
  }
  const aprValue = result[0].apr;
  return <StakingAprAd aprValue={aprValue} onPress={onPress} />;
};

const EthStakingListItem = ({
  networkId,
  accountId,
}: IStakingListItemProps) => {
  const navigation = useAppNavigation();
  const { result } = usePromiseResult(
    () => backgroundApiProxy.serviceStaking.getApr('eth'),
    [],
  );
  const onPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.EthLidoOverview,
      params: { networkId, accountId },
    });
  }, [navigation, networkId, accountId]);
  if (!result) {
    return null;
  }
  const aprValue = result[0].apr;
  return <StakingAprAd aprValue={aprValue} onPress={onPress} />;
};

export const StakingApr = ({
  networkId,
  accountId,
  tokenAddress,
}: IStakingListItemProps) => {
  if (
    [getNetworkIdsMap().eth, getNetworkIdsMap().sepolia].includes(networkId) &&
    !tokenAddress
  ) {
    return (
      <EthStakingListItem
        networkId={networkId}
        accountId={accountId}
        tokenAddress={tokenAddress}
      />
    );
  }
  if (
    (networkId === getNetworkIdsMap().eth &&
      tokenAddress.toLowerCase() === EthereumMatic) ||
    (networkId === getNetworkIdsMap().sepolia &&
      tokenAddress.toLowerCase() === SepoliaMatic)
  ) {
    return (
      <MaticStakingAprAd
        networkId={networkId}
        accountId={accountId}
        tokenAddress={tokenAddress}
      />
    );
  }
  return null;
};
