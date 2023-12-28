import { StyleSheet } from 'react-native';

import {
  Heading,
  Image,
  Page,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';

type IWalletItem = {
  name?: string;
  logo?: any;
};

type IWalletGroup = {
  title?: string;
  data: IWalletItem[];
};

const wallets: IWalletGroup[] = [
  {
    data: [
      {
        name: 'MetaMask',
        logo: require('../../../../assets/onboarding/logo_metamask.png'),
      },
      {
        name: 'Trust Wallet',
        logo: require('../../../../assets/onboarding/logo_trustwallet.png'),
      },
      {
        name: 'Rainbow',
        logo: require('../../../../assets/onboarding/logo_rainbow.png'),
      },
      {
        name: 'imToken',
        logo: require('../../../../assets/onboarding/logo_imtoken.png'),
      },
      {
        name: 'OKX Wallet',
        logo: {
          uri: 'https://registry.walletconnect.org/v2/logo/sm/45f2f08e-fc0c-4d62-3e63-404e72170500',
        },
      },
      {
        name: 'TokenPocket',
        logo: require('../../../../assets/onboarding/logo_tokenpocket.png'),
      },
      {
        name: 'Zerion',
        logo: {
          uri: 'https://registry.walletconnect.org/v2/logo/sm/73f6f52f-7862-49e7-bb85-ba93ab72cc00',
        },
      },
      {
        name: 'Walletconnect',
        logo: require('../../../../assets/onboarding/logo_walletconnect.png'),
      },
    ],
  },
  {
    title: 'Institutional Wallets',
    data: [
      {
        name: 'Fireblocks',
        logo: {
          uri: 'https://registry.walletconnect.org/v2/logo/sm/7e1514ba-932d-415d-1bdb-bccb6c2cbc00',
        },
      },
      {
        name: 'Amber',
        logo: require('../../../../assets/onboarding/logo_amber.png'),
      },
      {
        name: 'Cobo Wallet',
        logo: require('../../../../assets/onboarding/logo_cobo_wallet.png'),
      },
      {
        name: 'Jade Wallet',
        logo: {
          uri: 'https://registry.walletconnect.org/v2/logo/sm/280cd57b-24f4-4700-8d53-94fe292fab00',
        },
      },
    ],
  },
];

export function ConnectWallet() {
  return (
    <Page scrollEnabled>
      <Page.Header title="Connect 3rd-party Wallet" />
      <Page.Body>
        {wallets.map(({ title, data }) => (
          <Stack p="$5">
            {title && (
              <Heading pb="$2.5" color="$textSubdued" size="$headingSm">
                {title}
              </Heading>
            )}
            <XStack flexWrap="wrap" mx="$-1">
              {data.map(({ name, logo }) => (
                <Stack
                  flexBasis="50%"
                  $gtMd={{
                    flexBasis: '25%',
                  }}
                  p="$1"
                >
                  <Stack
                    justifyContent="center"
                    alignItems="center"
                    bg="$bgSubdued"
                    borderWidth={StyleSheet.hairlineWidth}
                    borderColor="$borderSubdued"
                    borderRadius="$3"
                    style={{
                      borderCurve: 'continuous',
                    }}
                    p="$4"
                    hoverStyle={{
                      bg: '$bgHover',
                    }}
                    pressStyle={{
                      bg: '$bgActive',
                    }}
                    focusable
                    focusStyle={{
                      outlineColor: '$focusRing',
                      outlineStyle: 'solid',
                      outlineWidth: 2,
                      outlineOffset: 2,
                    }}
                  >
                    <Stack
                      w="$8"
                      h="$8"
                      borderRadius="$2"
                      borderWidth={StyleSheet.hairlineWidth}
                      borderColor="$borderSubdued"
                      style={{
                        borderCurve: 'continuous',
                      }}
                      overflow="hidden"
                    >
                      <Image w="100%" h="100%" source={logo} />
                    </Stack>
                    <SizableText userSelect="none" mt="$2" size="$bodyMdMedium">
                      {name}
                    </SizableText>
                  </Stack>
                </Stack>
              ))}
            </XStack>
          </Stack>
        ))}
      </Page.Body>
    </Page>
  );
}

export default ConnectWallet;
