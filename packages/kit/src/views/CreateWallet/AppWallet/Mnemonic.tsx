import React, { useCallback } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Button, Modal, Typography } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { Text } from '@onekeyhq/components/src/Typography';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDrawer, useNavigation, useToast } from '../../../hooks';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '../../../routes/Modal/CreateWallet';
import { setEnableLocalAuthentication } from '../../../store/reducers/settings';
import { savePassword } from '../../../utils/localAuthentication';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.MnemonicModal
>;

const Mnemonic = () => {
  const route = useRoute<RouteProps>();
  const { mnemonic, password, withEnableAuthentication } = route.params ?? {};
  const words = mnemonic.split(' ').filter(Boolean);
  const toast = useToast();
  const intl = useIntl();
  const navigation = useNavigation();
  const { closeDrawer } = useDrawer();
  const onPress = useCallback(async () => {
    console.log('password', password, 'mnemonic', mnemonic);
    try {
      await backgroundApiProxy.serviceAccount.createHDWallet({
        password,
        mnemonic,
      });
      if (withEnableAuthentication) {
        backgroundApiProxy.dispatch(setEnableLocalAuthentication(true));
        await savePassword(password);
      }
    } catch (e) {
      const errorKey = (e as { key: LocaleIds }).key;
      toast.show({ title: intl.formatMessage({ id: errorKey }) });
    }
    closeDrawer();
    const inst = navigation.getParent() || navigation;
    inst.goBack();
  }, [mnemonic, password, withEnableAuthentication]);
  return (
    <Modal footer={null}>
      <Box mb="16" textAlign="center">
        <Text typography={{ sm: 'DisplayLarge', md: 'DisplayMedium' }} mb="3">
          👀 For Your Eyes Only
        </Text>
        <Typography.Body1 color="text-subdued" textAlign="center">
          Never share the recovery phrase. Anyone with these words will have
          full access to your wallet.
        </Typography.Body1>
      </Box>
      <Typography.Body1Strong mb="4" textAlign="center">
        ↓ Click Below to Copy ↓
      </Typography.Body1Strong>
      <Box bg="surface-default" shadow="depth.2" borderRadius="12" p="4">
        <Box flexDirection="row">
          <Box w="50%">
            {words.slice(0, 6).map((word, i) => (
              <Box flexDirection="row">
                <Typography.Body1Strong color="text-subdued" w="8">
                  {i + 1}.
                </Typography.Body1Strong>
                <Typography.Body1Strong color="text-default">
                  {word}
                </Typography.Body1Strong>
              </Box>
            ))}
          </Box>
          <Box w="50%">
            {words.slice(6).map((word, i) => (
              <Box flexDirection="row">
                <Typography.Body1Strong color="text-subdued" w="8">
                  {i + 7}.
                </Typography.Body1Strong>
                <Typography.Body1Strong color="text-default">
                  {word}
                </Typography.Body1Strong>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      <Button size="lg" type="primary" mt="4" onPromise={onPress}>
        I’ve Saved the Phrase
      </Button>
    </Modal>
  );
};

export default Mnemonic;
