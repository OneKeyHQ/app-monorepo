import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import type { Account } from '@onekeyhq/engine/src/types/account';

import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import AccountSelectorModal from '../components/AccountSelectorModal';
import { useSwapRecipient } from '../hooks/useSwap';
import { SwapRoutes } from '../typings';

import type { SwapRoutesParams } from '../typings';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.SelectRecipient>;

const SelectSendingAccount = () => {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const recipient = useSwapRecipient();

  const onSelected = useCallback(
    (acc: Account) => {
      route.params?.onSelected?.({
        address: acc.address,
        name: acc.name,
        accountId: acc.id,
      });
      navigation.goBack();
    },
    [route, navigation],
  );

  const networkId = route.params?.networkId;

  const onPrimaryActionPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.EnterAddress,
        params: {
          networkId,
          contactExcludeWalletAccount: true,
          onSelected: (data) => {
            route.params?.onSelected?.({
              address: data.address,
              name: data?.name,
            });
          },
        },
      },
    });
  }, [navigation, networkId, route.params]);

  return (
    <AccountSelectorModal
      accountId={recipient?.accountId}
      networkId={route.params?.networkId}
      onSelect={onSelected}
      hideSecondaryAction
      primaryActionTranslationId="form__enter_address"
      primaryActionProps={{
        onPress: onPrimaryActionPress,
        type: 'basic',
        leftIconName: 'PencilSolid',
      }}
    />
  );
};

export default SelectSendingAccount;
