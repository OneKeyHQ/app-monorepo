import { useState } from 'react';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Anchor,
  Button,
  Dialog,
  HeightTransition,
  Image,
  ListItem,
  Page,
  SizableText,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EOnboardingPages } from '../router/type';

export function GetStarted() {
  const { bottom } = useSafeAreaInsets();
  const [showDevices, setShowDevices] = useState(false);

  const navigation = useAppNavigation();

  const handleCreateWalletPress = () => {
    navigation.push(EOnboardingPages.BeforeShowRecoveryPhrase);
  };

  const handleImportWalletPress = () => {
    navigation.push(EOnboardingPages.ImportWalletOptions);
  };

  const handleConnectHardwareWallet = () => {
    navigation.push(EOnboardingPages.ConnectYourDevice);
  };

  const handleImportPrivateKeyPress = () => {
    navigation.push(EOnboardingPages.ImportPrivateKey);
  };

  const handleImportAddressPress = () => {
    navigation.push(EOnboardingPages.ImportAddress);
  };

  const DevicesData = [
    {
      name: 'OneKey Classic',
      avatar: require('../../../../assets/wallet/avatar/Classic.png'),
    },
    {
      name: 'OneKey Mini',
      avatar: require('../../../../assets/wallet/avatar/Mini.png'),
    },
    {
      name: 'OneKey Touch',
      avatar: require('../../../../assets/wallet/avatar/Touch.png'),
    },
  ];

  return (
    <Page>
      <Page.Header headerShown={false} />
      <Page.Body p="$5" space="$5">
        <Stack flex={1} justifyContent="center" alignItems="center">
          {/* <Image
            w="$16"
            h="$16"
            source={require('../../../../assets/logo.png')}
          />

          <Heading
            size="$heading3xl"
            $gtMd={{
              size: '$heading4xl',
            }}
            pt="$5"
          >
            Welcome to OneKey
          </Heading> */}
        </Stack>
        <Stack space="$2">
          {/* <SizableText textAlign="center" pb="$3" size="$headingLg">
            How would you like to get started?
          </SizableText> */}
          <Button
            icon="OnekeyBrand"
            variant="primary"
            $md={
              {
                size: 'large',
              } as IButtonProps
            }
            onPress={handleConnectHardwareWallet}
            // onPress={() => {
            //   setTimeout(() => {
            //     setShowDevices(true);
            //   }, 1000);

            //   Dialog.show({
            //     title: 'Searching for devices...',
            //     showFooter: false,
            //     renderContent: (
            //       <Stack mx="$-5">
            //         <HeightTransition>
            //           {DevicesData.map((item, index) => (
            //             <ListItem
            //               key={index}
            //               drillIn
            //               onPress={() => console.log('clicked')}
            //               focusable={false}
            //             >
            //               <Image
            //                 width={40}
            //                 height={40}
            //                 style={{
            //                   width: 40,
            //                   height: 40,
            //                 }}
            //                 source={item.avatar}
            //               />
            //               <ListItem.Text flex={1} primary={item.name} />
            //             </ListItem>
            //           ))}
            //         </HeightTransition>
            //       </Stack>
            //     ),
            //   });
            // }}
          >
            Connect Hardware Wallet
          </Button>
          <Button
            icon="PlusCircleOutline"
            onPress={handleCreateWalletPress}
            $md={
              {
                size: 'large',
              } as IButtonProps
            }
          >
            Create Wallet
          </Button>
          <Button
            icon="ArrowBottomCircleOutline"
            onPress={handleImportWalletPress}
            $md={
              {
                size: 'large',
              } as IButtonProps
            }
          >
            Import Wallet
          </Button>
          <Button
            icon="LinkOutline"
            onPress={handleImportWalletPress}
            variant="tertiary"
            m="$0"
            $md={
              {
                size: 'large',
              } as IButtonProps
            }
          >
            Connect 3rd-party Wallet
          </Button>
          {/* <Button
            icon="ArrowBottomCircleOutline"
            onPress={handleImportPrivateKeyPress}
            $md={{
              size: 'large',
            } as IButtonProps}
          >
            Import Private Key
          </Button>
          <Button
            icon="ArrowBottomCircleOutline"
            onPress={handleImportAddressPress}
            $md={{
              size: 'large',
            } as IButtonProps}
          >
            Import Address
          </Button>
          <Button
            icon="ArrowBottomCircleOutline"
            onPress={handleImportWalletPress}
            $md={{
              size: 'large',
            } as IButtonProps}
          >
            Connect 3rd-party Wallet
          </Button> */}
        </Stack>
        <SizableText
          size="$bodySm"
          color="$textDisabled"
          textAlign="center"
          {...(bottom && {
            pb: bottom,
          })}
        >
          By using this app, you agree to our{' '}
          <Anchor
            href="https://help.onekey.so/hc/articles/360002014776"
            size="$bodySm"
            color="$textSubdued"
            target="_blank"
            textDecorationLine="none"
          >
            User Service Agreement
          </Anchor>{' '}
          and{' '}
          <Anchor
            href="https://help.onekey.so/hc/articles/360002003315"
            size="$bodySm"
            color="$textSubdued"
            target="_blank"
            textDecorationLine="none"
          >
            Privacy Policy
          </Anchor>
        </SizableText>
      </Page.Body>
    </Page>
  );
}
