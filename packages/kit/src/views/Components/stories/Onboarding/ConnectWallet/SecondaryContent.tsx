import React, { FC } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  Box,
  Center,
  Hidden,
  Icon,
  Image,
  Pressable,
  Text,
} from '@onekeyhq/components';
import LogoBitKeep from '@onekeyhq/kit/assets/onboarding/logo_bitkeep.png';
import LogoImToken from '@onekeyhq/kit/assets/onboarding/logo_imtoken.png';
import LogoLedger from '@onekeyhq/kit/assets/onboarding/logo_ledger.png';
import LogoMetaMask from '@onekeyhq/kit/assets/onboarding/logo_metamask.png';
import LogoRainbow from '@onekeyhq/kit/assets/onboarding/logo_rainbow.png';
import LogoTokenPocket from '@onekeyhq/kit/assets/onboarding/logo_tokenpocket.png';
import LogoTrezor from '@onekeyhq/kit/assets/onboarding/logo_trezor.png';
import LogoTrustWallet from '@onekeyhq/kit/assets/onboarding/logo_trustwallet.png';
import LogoWalletConnect from '@onekeyhq/kit/assets/onboarding/logo_walletconnect.png';

type SecondaryContentProps = {};

const defaultProps = {} as const;

const SecondaryContent: FC<SecondaryContentProps> = () => {
  const intl = useIntl();

  const options = [
    {
      logo: LogoMetaMask,
      label: 'MetaMask',
      available: true,
    },
    {
      logo: LogoTrustWallet,
      label: 'Trust Wallet',
      available: true,
    },
    {
      logo: LogoRainbow,
      label: 'Rainbow',
      available: true,
    },
    {
      logo: LogoImToken,
      label: 'imToken',
      available: true,
    },
    {
      logo: LogoTokenPocket,
      label: 'Token Pocket',
      available: true,
    },
    {
      logo: LogoBitKeep,
      label: 'BitKeep',
      available: true,
    },
    {
      logo: LogoWalletConnect,
      label: 'WalletConenct',
      available: true,
    },
    {
      logo: LogoTrezor,
      label: 'Trezor',
      available: false,
    },
    {
      logo: LogoLedger,
      label: 'Ledger',
      available: false,
    },
  ];

  return (
    <>
      <Center flex={1}>
        <Hidden from="sm">
          <Box
            w="full"
            h={StyleSheet.hairlineWidth}
            bgColor="divider"
            mt={-4}
            mb={1}
          />
        </Hidden>
        <Box
          flexDir={{ sm: 'row' }}
          flexWrap={{ sm: 'wrap' }}
          alignSelf="stretch"
          mx={-2}
        >
          {options.map((option) => (
            <Pressable
              flexDir={{ base: 'row', sm: 'column' }}
              w={{ sm: '1/3' }}
              alignItems="center"
              my={{ base: 1, sm: '18px' }}
              px={2}
              py={{ base: 3, sm: 2 }}
              _hover={{ bgColor: 'surface-hovered' }}
              _pressed={{ bgColor: 'surface-pressed' }}
              rounded="xl"
              disabled={!option.available}
            >
              <Image
                source={option.logo}
                size={8}
                borderWidth={StyleSheet.hairlineWidth}
                borderColor="border-subdued"
                rounded="xl"
              />
              <Text
                flex={1}
                mx={{ base: 3, sm: 0 }}
                mt={{ sm: 2 }}
                typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                isTruncated
              >
                {option.label}
              </Text>
              {option.available ? (
                <Hidden from="sm">
                  <Icon name="ChevronRightSolid" size={20} />
                </Hidden>
              ) : (
                <>
                  <Hidden from="sm">
                    <Badge
                      size="sm"
                      title={intl.formatMessage({ id: 'badge__coming_soon' })}
                    />
                  </Hidden>
                  <Hidden till="sm">
                    <Text typography="Caption" color="text-subdued">
                      {intl.formatMessage({ id: 'badge__coming_soon' })}
                    </Text>
                  </Hidden>
                </>
              )}
            </Pressable>
          ))}
        </Box>
      </Center>
    </>
  );
};

SecondaryContent.defaultProps = defaultProps;

export default SecondaryContent;
