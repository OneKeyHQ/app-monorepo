import { useCallback } from 'react';

import { StyleSheet } from 'react-native';

import { Icon, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EthereumMatic } from '@onekeyhq/shared/src/consts/addresses';
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
}) => (
  <ListItem
    drillIn
    onPress={onPress}
    py="$3"
    px="$5"
    mx="$0"
    bg="$bgSuccessSubdued"
    borderTopWidth={StyleSheet.hairlineWidth}
    borderColor="$borderSubdued"
    borderRadius="$0"
  >
    <Stack p="$3" borderRadius="$full" bg="$bgSuccess">
      <Icon name="ChartColumnar3Outline" color="$iconSuccess" />
    </Stack>
    <ListItem.Text
      flex={1}
      primary="Stake and Earn"
      secondary={`Up to ${aprValue}% in Annual Rewards`}
      secondaryTextProps={{
        size: '$bodyMdMedium',
        color: '$textSuccess',
      }}
    />
  </ListItem>
);

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
  if (networkId === getNetworkIdsMap().eth && !tokenAddress) {
    return (
      <EthStakingListItem
        networkId={networkId}
        accountId={accountId}
        tokenAddress={tokenAddress}
      />
    );
  }
  if (
    networkId === getNetworkIdsMap().eth &&
    tokenAddress.toLowerCase() === EthereumMatic
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
