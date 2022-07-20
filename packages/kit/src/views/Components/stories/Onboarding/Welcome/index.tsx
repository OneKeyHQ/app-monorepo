import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Hidden, Icon, Image, Text } from '@onekeyhq/components';
import TinyLedger from '@onekeyhq/kit/assets/onboarding/tiny_ledger.png';
import TinyMetaMask from '@onekeyhq/kit/assets/onboarding/tiny_metamask.png';
import TinyOneKey from '@onekeyhq/kit/assets/onboarding/tiny_onekey.png';
import TinyTokenPocket from '@onekeyhq/kit/assets/onboarding/tiny_tokenpocket.png';
import TinyTrezor from '@onekeyhq/kit/assets/onboarding/tiny_trezor.png';

import PressableListItem from './PressableListItem';

type WelcomeProps = {};

const Welcome: FC<WelcomeProps> = () => {
  const intl = useIntl();

  return (
    <Box minH={480}>
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
          borderBottomRadius={{ base: 0, sm: 'xl' }}
        />
        <PressableListItem
          icon="SaveOutline"
          label={intl.formatMessage({
            id: 'action__import_wallet',
          })}
          mt="-1px"
          mb={{ base: 8, sm: 0 }}
          borderTopRadius={{ base: 0, sm: 'xl' }}
        />
        <PressableListItem
          icon="ConnectOutline"
          label={intl.formatMessage({
            id: 'action__connect_wallet',
          })}
        >
          <Box
            flexDir="row"
            position="absolute"
            top={{ base: 21, sm: 33 }}
            right={{ base: 44, sm: 25 }}
          >
            <Image source={TinyOneKey} size={4} mx={0.5} />
            <Image source={TinyTrezor} size={4} mx={0.5} />
            <Center mx={0.5} size={4}>
              <Image source={TinyLedger} size="18px" />
            </Center>
            <Image source={TinyMetaMask} size={4} mx={0.5} />
            <Image source={TinyTokenPocket} size={4} mx={0.5} />
          </Box>
        </PressableListItem>
        <Hidden from="sm">
          <Text mt={3} mx={2} color="text-subdued" typography="Body2">
            {intl.formatMessage({ id: 'content__supported_wallets' })}
          </Text>
        </Hidden>
      </Box>
    </Box>
  );
};

export default Welcome;
