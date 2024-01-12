import { StyleSheet } from 'react-native';

import type { IButtonProps } from '@onekeyhq/components';
import {
  Anchor,
  Button,
  Divider,
  Group,
  Heading,
  Icon,
  Image,
  ListItem,
  Page,
  SizableText,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EOnboardingPages } from '../router/type';

export function GetStarted() {
  const { bottom } = useSafeAreaInsets();

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

  const handleConnectWalletPress = () => {
    navigation.push(EOnboardingPages.ConnectWallet);
  };

  return (
    <Page>
      <Page.Header headerShown={false} />
      <Page.Body p="$5">
        <Stack flex={1} justifyContent="center" alignItems="center">
          <Image
            w="$16"
            h="$16"
            source={require('@onekeyhq/kit/assets/logo-decorated.png')}
          />

          <Heading
            size="$heading3xl"
            $gtMd={{
              size: '$heading3xl',
            }}
            pt="$5"
            textAlign="center"
          >
            Simplify Crypto, Amplify Security
          </Heading>
        </Stack>
        <Stack
          py="$5"
          $gtMd={{
            px: '$5',
          }}
        >
          <ListItem
            m="0"
            px="$4"
            py="$3.5"
            bg="$bgPrimary"
            borderWidth={StyleSheet.hairlineWidth}
            borderRadius="$3"
            borderColor="$transparent"
            onPress={handleConnectHardwareWallet}
            hoverStyle={{
              bg: '$bgPrimaryHover',
            }}
            pressStyle={{
              bg: '$bgPrimaryActive',
            }}
          >
            <Stack
              alignSelf="flex-start"
              bg="$whiteA2"
              $theme-dark={{
                bg: '$blackA2',
              }}
              p="$2"
              borderRadius="$2"
              style={{ borderCurve: 'continuous' }}
            >
              <Icon
                name={platformEnv.isNative ? 'BluetoothOutline' : 'UsbOutline'}
                color="$iconInverse"
              />
            </Stack>
            <ListItem.Text
              userSelect="none"
              flex={1}
              primary="Connect Hardware Wallet"
              primaryTextProps={{
                color: '$textInverse',
              }}
              secondary="Your secure crypto solution"
              secondaryTextProps={{
                color: '$textInverseSubdued',
              }}
            />
            <ListItem.DrillIn
              color="$whiteA6"
              $theme-dark={{
                color: '$blackA6',
              }}
            />
          </ListItem>

          <Group
            bg="$bgSubdued"
            borderWidth={StyleSheet.hairlineWidth}
            borderRadius="$3"
            borderColor="$borderSubdued"
            separator={<Divider />}
            my="$5"
          >
            <ListItem
              m="0"
              px="$4"
              py="$3.5"
              drillIn
              onPress={handleCreateWalletPress}
            >
              <Stack
                alignSelf="flex-start"
                bg="$bgStrong"
                p="$2"
                borderRadius="$2"
                style={{ borderCurve: 'continuous' }}
              >
                <Icon name="PlusCircleOutline" />
              </Stack>
              <ListItem.Text
                userSelect="none"
                flex={1}
                primary="Create Wallet"
                secondary="Create new recovery phrase"
              />
            </ListItem>
            <ListItem
              m="0"
              px="$4"
              py="$3.5"
              drillIn
              onPress={handleImportWalletPress}
            >
              <Stack
                alignSelf="flex-start"
                bg="$bgStrong"
                p="$2"
                borderRadius="$2"
                style={{ borderCurve: 'continuous' }}
              >
                <Icon name="ArrowBottomCircleOutline" />
              </Stack>
              <ListItem.Text
                userSelect="none"
                flex={1}
                primary="Import Wallet"
                secondary="Import recovery phrase, private key or address"
                secondaryTextProps={{
                  numberOfLines: 1,
                }}
              />
            </ListItem>
          </Group>
          <Button
            onPress={handleConnectWalletPress}
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
        </Stack>
        <SizableText
          size="$bodySm"
          color="$textDisabled"
          textAlign="center"
          {...(bottom && {
            pb: bottom,
          })}
          $md={{
            maxWidth: 300,
            mx: 'auto',
          }}
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

export default GetStarted;
