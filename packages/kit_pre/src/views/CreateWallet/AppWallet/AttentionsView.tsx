import type { FC } from 'react';
import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { CreateWalletModalRoutes } from '../../../routes/routesEnum';

import { Attentions } from './Attentions';

import type { CreateWalletRoutesParams } from '../../../routes/Root/Modal/CreateWallet';
import type { NavigationProp, RouteProp } from '@react-navigation/native';

type NavigationProps = NavigationProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AttentionsModal
>;

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AttentionsModal
>;

const AttentionsContainer: FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { password, withEnableAuthentication } = route.params ?? {};
  const onPress = useCallback(async () => {
    const mnemonic = await backgroundApiProxy.engine.generateMnemonic();
    navigation.navigate(CreateWalletModalRoutes.MnemonicModal, {
      password,
      withEnableAuthentication,
      mnemonic,
    });
  }, [navigation, password, withEnableAuthentication]);
  return <Attentions onPress={onPress} />;
};

export default AttentionsContainer;
