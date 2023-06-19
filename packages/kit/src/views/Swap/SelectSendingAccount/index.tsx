import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import type { Account } from '@onekeyhq/engine/src/types/account';

import { useAppSelector } from '../../../hooks';
import AccountSelectorModal from '../components/AccountSelectorModal';

import type { SwapRoutes, SwapRoutesParams } from '../typings';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.SelectSendingAccount>;

const SelectSendingAccount = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);

  const onSelected = useCallback(
    (acc: Account) => {
      route.params?.onSelected?.(acc);
      navigation.goBack();
    },
    [route, navigation],
  );

  return (
    <AccountSelectorModal
      accountId={sendingAccount?.id}
      networkId={route.params?.networkId}
      onSelect={onSelected}
      footer={null}
    />
  );
};

export default SelectSendingAccount;
