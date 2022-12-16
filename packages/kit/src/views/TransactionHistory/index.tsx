import { FC, useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';
import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';

import HistoricalRecords from '../Wallet/HistoricalRecords';

type RouteProps = RouteProp<
  HomeRoutesParams,
  HomeRoutes.TransactionHistoryScreen
>;

const TransactionHistory: FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();

  const intl = useIntl();

  const { tokenId, historyFilter } = route.params;

  const { accountId, networkId } = useActiveWalletAccount();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: intl.formatMessage({ id: 'transaction__history' }),
    });
  }, [intl, navigation]);

  return (
    <HistoricalRecords
      accountId={accountId}
      networkId={networkId}
      tokenId={tokenId}
      historyFilter={historyFilter}
      hiddenHeader
    />
  );
};

export default TransactionHistory;
