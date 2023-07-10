import { useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';

import { VStack } from '@onekeyhq/components';

import { useActiveWalletAccount } from '../../../hooks';
import { HomeRoutes } from '../../../routes/routesEnum';
import { useRpcMeasureStatus } from '../../ManageNetworks/hooks';
import { HistoryPendingButton } from '../../Swap/HistoryButton';
import { useWalletsSwapTransactions } from '../../Swap/hooks/useTransactions';

import Offline from './Offline';

import type { HomeRoutesParams } from '../../../routes/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<HomeRoutesParams>;

export const BottomView = () => {
  const [offline, setOffline] = useState(false);

  const transactions = useWalletsSwapTransactions();
  const navigation = useNavigation<NavigationProps>();
  const pendings = transactions.filter(
    (tx) => tx.status === 'pending' && tx.type === 'swap',
  );
  const onPress = useCallback(() => {
    navigation.navigate(HomeRoutes.SwapHistory);
  }, [navigation]);

  const { networkId } = useActiveWalletAccount();

  const { status, loading } = useRpcMeasureStatus(networkId);

  useEffect(() => {
    if (!loading && status && typeof status?.responseTime === 'undefined') {
      setOffline(true);
    } else {
      setOffline(false);
    }
  }, [status, loading]);

  if (offline) {
    return (
      <VStack
        position="absolute"
        height="36px"
        w="full"
        bottom="20px"
        justifyContent="center"
        alignItems="center"
        space={1}
      >
        <Offline />
      </VStack>
    );
  }
  if (pendings.length > 0) {
    return (
      <VStack
        position="absolute"
        height="36px"
        w="full"
        bottom="20px"
        justifyContent="center"
        alignItems="center"
        space={1}
      >
        <HistoryPendingButton onPress={onPress} />
      </VStack>
    );
  }

  return null;
};
