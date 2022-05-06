import React, { useCallback, FC } from 'react';
import {
  useNavigation,
  useRoute,
  RouteProp,
  NavigationProp,
} from '@react-navigation/native';
import { Modal, Button, Center, Icon, Typography } from '@onekeyhq/components';

import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '../../../routes/Modal/CreateWallet';
import backgroundApiProxy from '../../../background/instance/backgroundApiProxy'

type NavigationProps = NavigationProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AttentionsModal
>;

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.MnemonicModal
>;

const Attentions = () => {
  const navigation = useNavigation<NavigationProps>()
  const route = useRoute<RouteProps>();
  const { password, withEnableAuthentication } = route.params ?? {}
  const onPress = useCallback(async () => {
    const mnemonic = await backgroundApiProxy.engine.generateMnemonic();
    navigation.navigate(CreateWalletModalRoutes.MnemonicModal, {
      password, 
      withEnableAuthentication,
      mnemonic
    })
  }, [navigation, password, withEnableAuthentication])
  return (
    <Modal footer={null}>
      <Center mb='6'>
        <Center w='16' h='16' bg='surface-warning-default' borderRadius='full'>
          <Icon name='ExclamationOutline' width={24} height={24}></Icon>
        </Center>
        <Typography.DisplayLarge mt='4'>Attention</Typography.DisplayLarge>
      </Center>
      <Button size='lg' type='primary' onPress={onPress}>Reveal Recovery Phrase</Button>
    </Modal>
  )
};

export default Attentions