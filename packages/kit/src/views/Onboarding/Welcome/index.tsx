import React, { FC } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Hidden,
  Icon,
  IconButton,
  Image,
  Text,
} from '@onekeyhq/components';
import { useSafeAreaInsets } from '@onekeyhq/components/src/Provider/hooks';
import LogoLedger from '@onekeyhq/kit/assets/onboarding/logo_ledger.png';
import LogoMetaMask from '@onekeyhq/kit/assets/onboarding/logo_metamask.png';
import LogoOneKey from '@onekeyhq/kit/assets/onboarding/logo_onekey.png';
import LogoTokenPocket from '@onekeyhq/kit/assets/onboarding/logo_tokenpocket.png';
import LogoTrezor from '@onekeyhq/kit/assets/onboarding/logo_trezor.png';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import Layout from '../Layout';

import PressableListItem from './PressableListItem';
import TermsOfService from './TermsOfService';

type WelcomeProps = {
  onPressCreateWallet?: () => void;
  onPressImportWallet?: () => void;
  onPressConnectWallet?: () => void;
  visible?: boolean;
};

const Welcome: FC<WelcomeProps> = ({
  onPressCreateWallet,
  onPressImportWallet,
  onPressConnectWallet,
  visible,
}) => {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const insets = useSafeAreaInsets();

  const logos = [
    LogoOneKey,
    LogoTrezor,
    LogoLedger,
    LogoMetaMask,
    LogoTokenPocket,
  ];

  return (
    <>
      {/* Close button */}
      <IconButton
        position="absolute"
        onPress={() => navigation.goBack()}
        top={{ base: 4 + insets.top, sm: 8 }}
        right={{ base: 4, sm: 8 }}
        type="plain"
        size="lg"
        name="CloseOutline"
        circle
      />
      <Layout
        backButton={false}
        mt={{ base: 20, sm: 0 }}
        scaleFade
        visible={visible}
      >
        <Icon name="BrandLogoIllus" size={48} />
        <Text typography={{ sm: 'DisplayXLarge', md: 'Display2XLarge' }} mt={6}>
          {intl.formatMessage({ id: 'onboarding__landing_welcome_title' })}
          {'\n'}
          <Text color="text-subdued">
            {intl.formatMessage({ id: 'onboarding__landing_welcome_desc' })}
          </Text>
        </Text>
        <Box flexDir={{ sm: 'row' }} mt={{ base: 16, sm: 20 }} mx={-2}>
          <PressableListItem
            icon="PlusCircleOutline"
            label={intl.formatMessage({
              id: 'action__create_wallet',
            })}
            roundedBottom={{ base: 0, sm: 'xl' }}
            onPress={onPressCreateWallet}
          />
          <PressableListItem
            icon="SaveOutline"
            label={intl.formatMessage({
              id: 'action__import_wallet',
            })}
            mt="-1px"
            mb={{ base: 8, sm: 0 }}
            roundedTop={{ base: 0, sm: 'xl' }}
            onPress={onPressImportWallet}
          />
          <PressableListItem
            icon="ConnectOutline"
            label={intl.formatMessage({
              id: 'action__connect_wallet',
            })}
            onPress={onPressConnectWallet}
          >
            <Box
              flexDir="row"
              position="absolute"
              top={{ base: 21, sm: 33 }}
              right={{ base: 44, sm: 25 }}
            >
              {logos.map((logo, index) => (
                <Image
                  key={index}
                  source={logo}
                  size={4}
                  mx={0.5}
                  borderWidth={StyleSheet.hairlineWidth}
                  borderColor="border-subdued"
                  rounded="sm"
                />
              ))}
            </Box>
          </PressableListItem>
          <Hidden from="sm">
            <Text mt={3} mx={2} color="text-subdued" typography="Body2">
              {intl.formatMessage({ id: 'content__supported_wallets' })}
            </Text>
          </Hidden>
        </Box>
      </Layout>
      <TermsOfService />
    </>
  );
};

export default Welcome;
