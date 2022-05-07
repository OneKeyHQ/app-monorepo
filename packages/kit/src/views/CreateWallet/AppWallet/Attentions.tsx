import React, { useCallback } from 'react';

import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Icon,
  Modal,
  Typography,
} from '@onekeyhq/components';
import { useSafeAreaInsets } from '@onekeyhq/components/src/Provider/hooks';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '../../../routes/Modal/CreateWallet';

type NavigationProps = NavigationProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.AttentionsModal
>;

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.MnemonicModal
>;

const Attentions = () => {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { password, withEnableAuthentication } = route.params ?? {};
  const intl = useIntl();
  const insets = useSafeAreaInsets();
  const onPress = useCallback(async () => {
    const mnemonic = await backgroundApiProxy.engine.generateMnemonic();
    navigation.navigate(CreateWalletModalRoutes.MnemonicModal, {
      password,
      withEnableAuthentication,
      mnemonic,
    });
  }, [navigation, password, withEnableAuthentication]);
  const List = [
    {
      emoji: '🔐',
      desc: intl.formatMessage({ id: 'modal__attention_unlock' }),
    },
    { emoji: '🤫', desc: intl.formatMessage({ id: 'modal__attention_shh' }) },
    {
      emoji: '🙅‍♂️',
      desc: intl.formatMessage({ id: 'modal__attention_gesturing_no' }),
    },
  ];

  return (
    <Modal footer={null}>
      <Box flex={1} px={{ base: 2, md: 0 }}>
        <Box flex={1}>
          <Center mb={8}>
            <Center p={4} mb={4} bg="surface-warning-default" rounded="full">
              <Icon
                name="ExclamationOutline"
                width={24}
                height={24}
                color="icon-warning"
              />
            </Center>
            <Typography.DisplayLarge>
              {intl.formatMessage({ id: 'modal__attention' })}
            </Typography.DisplayLarge>
          </Center>
          {List.map((item) => (
            <Box flexDirection="row" mb={4}>
              <Typography.DisplayLarge mt={-1} mr={4}>
                {item.emoji}
              </Typography.DisplayLarge>
              <Typography.Body1 flex={1}>{item.desc}</Typography.Body1>
            </Box>
          ))}
        </Box>
        <Button
          mt={4}
          mb={insets.bottom}
          size="xl"
          type="primary"
          onPress={onPress}
        >
          {intl.formatMessage({ id: 'action__reveal_recovery_phrase' })}
        </Button>
      </Box>
    </Modal>
  );
};

export default Attentions;
