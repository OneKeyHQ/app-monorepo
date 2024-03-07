import type { IButtonProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Anchor,
  Button,
  Divider,
  Group,
  Heading,
  Icon,
  Image,
  Page,
  SizableText,
  Stack,
  ThemeableStack,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EOnboardingPages } from '../router/type';

const ActionsItem = XStack.styleable<{
  iconName: IKeyOfIcons;
  label: string;
  primary?: boolean;
}>(({ iconName, label, primary, ...rest }) => (
  <XStack
    flexDirection="row"
    py="$3.5"
    px="$4"
    space="$3"
    borderRadius="$3"
    bg={primary ? '$bgPrimary' : '$bgStrong'}
    $gtMd={{
      py: '$3',
    }}
    hoverStyle={{
      bg: primary ? '$bgPrimaryHover' : '$bgStrongHover',
    }}
    pressStyle={{
      bg: primary ? '$bgPrimaryActive' : '$bgStrongActive',
    }}
    focusStyle={{
      outlineColor: '$focusRing',
      outlineOffset: 2,
      outlineStyle: 'solid',
      outlineWidth: 2,
    }}
    focusable
    userSelect="none"
    style={{
      borderCurve: 'continuous',
    }}
    {...rest}
  >
    <Icon name={iconName} color={primary ? '$iconInverse' : '$icon'} />
    <SizableText
      size="$bodyLgMedium"
      color={primary ? '$textInverse' : '$text'}
    >
      {label}
    </SizableText>
  </XStack>
));

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
      <Page.Body>
        <Stack flex={1}>
          <ThemeableStack
            fullscreen
            alignItems="center"
            justifyContent="center"
          >
            <Image
              w={360}
              h={360}
              source={require('@onekeyhq/kit/assets/logo-press.png')}
            />
          </ThemeableStack>

          <Stack px="$5" mt="auto">
            <Heading size="$heading4xl" textAlign="center">
              Welcome to OneKey
            </Heading>
            <SizableText size="$bodyLg" textAlign="center" color="$textSubdued">
              Simple, Secure Crypto Management
            </SizableText>
          </Stack>
        </Stack>
        <Stack
          py="$6"
          px="$5"
          space="$2.5"
          $gtMd={{
            maxWidth: '$96',
          }}
          alignSelf="center"
          w="100%"
        >
          <ActionsItem
            $gtMd={{
              borderRadius: '$2',
            }}
            iconName={platformEnv.isNative ? 'BluetoothOutline' : 'UsbOutline'}
            label="Connect Hardware Wallet"
            onPress={handleConnectHardwareWallet}
            primary
          />
          <Group
            borderRadius="$3"
            $gtMd={{
              borderRadius: '$2',
            }}
            separator={<Divider />}
          >
            <Group.Item>
              <ActionsItem
                iconName="PlusCircleOutline"
                label="Create Wallet"
                onPress={handleCreateWalletPress}
              />
            </Group.Item>
            <Group.Item>
              <ActionsItem
                iconName="ArrowBottomCircleOutline"
                label="Import Wallet"
                onPress={handleImportWalletPress}
              />
            </Group.Item>
          </Group>

          <ActionsItem
            $gtMd={{
              borderRadius: '$2',
            }}
            iconName="LinkOutline"
            label="Link External Wallet"
            onPress={handleConnectWalletPress}
          />
        </Stack>
        <SizableText
          size="$bodySm"
          color="$textDisabled"
          textAlign="center"
          p="$5"
          pt="$0"
        >
          Use implies consent to our{' '}
          <Anchor
            href="https://help.onekey.so/hc/articles/360002014776"
            size="$bodySm"
            color="$text"
            target="_blank"
            textDecorationLine="none"
          >
            Terms
          </Anchor>{' '}
          &{' '}
          <Anchor
            href="https://help.onekey.so/hc/articles/360002003315"
            size="$bodySm"
            color="$text"
            target="_blank"
            textDecorationLine="none"
          >
            Privacy
          </Anchor>
        </SizableText>
      </Page.Body>
    </Page>
  );
}

export default GetStarted;
