import { FC, useCallback } from 'react';

import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '../../../routes/Modal/CreateWallet';

import { Attentions } from './Attentions';

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
