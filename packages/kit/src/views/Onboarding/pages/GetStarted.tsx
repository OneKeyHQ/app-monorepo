import { useIntl } from 'react-intl';

import type { IKeyOfIcons, IXStackProps } from '@onekeyhq/components';
import {
  Anchor,
  Divider,
  Group,
  Heading,
  Icon,
  Image,
  LinearGradient,
  Page,
  SizableText,
  Stack,
  ThemeableStack,
  XStack,
} from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';

type IActionsGroupItem = {
  iconName: IKeyOfIcons;
  label: string;
  primary?: boolean;
} & IXStackProps;

type IActionsProp = {
  items: IActionsGroupItem[];
};

function ActionsGroup({ items }: IActionsProp) {
  return (
    <Group
      borderRadius="$3"
      $gtMd={{
        borderRadius: '$2',
      }}
      separator={<Divider />}
    >
      {items.map((item: IActionsGroupItem, index) => (
        <Group.Item key={index}>
          <XStack
            flexDirection="row"
            py="$3.5"
            px="$4"
            bg={item.primary ? '$bgPrimary' : '$bgStrong'}
            $gtMd={{
              py: '$2',
            }}
            hoverStyle={{
              bg: item.primary ? '$bgPrimaryHover' : '$bgStrongHover',
            }}
            pressStyle={{
              bg: item.primary ? '$bgPrimaryActive' : '$bgStrongActive',
            }}
            focusStyle={{
              outlineColor: '$focusRing',
              outlineStyle: 'solid',
              outlineWidth: 2,
            }}
            focusable
            userSelect="none"
            borderCurve="continuous"
            onPress={item.onPress}
            testID={item.testID}
          >
            <Icon
              name={item.iconName}
              color={item.primary ? '$iconInverse' : '$icon'}
            />
            <SizableText
              pl="$3"
              size="$bodyLgMedium"
              color={item.primary ? '$textInverse' : '$text'}
            >
              {item.label}
            </SizableText>
          </XStack>
        </Group.Item>
      ))}
    </Group>
  );
}

export function GetStarted() {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const handleCreateWalletPress = async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    navigation.push(EOnboardingPages.BeforeShowRecoveryPhrase);
  };

  const handleImportWalletPress = async () => {
    navigation.push(EOnboardingPages.ImportWalletOptions);
  };

  const handleConnectHardwareWallet = async () => {
    navigation.push(EOnboardingPages.ConnectYourDevice);
  };

  const handleConnectWalletPress = async () => {
    navigation.push(EOnboardingPages.ConnectWalletSelectNetworks);
  };

  const handleTrackAnyAddressPress = async () => {
    navigation.push(EOnboardingPages.ImportAddress);
  };

  const termsLink = useHelpLink({ path: 'articles/360002014776' });
  const privacyLink = useHelpLink({ path: 'articles/360002003315 ' });

  const isDappMode = platformEnv.isRuntimeBrowser && !platformEnv.isExtension;

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

          <Stack px="$5" pt="$10" mt="auto">
            <LinearGradient
              position="absolute"
              top="$0"
              left="$0"
              right="$0"
              bottom="$0"
              colors={['transparent', '$bgApp']}
              $platform-native={{
                display: 'none',
              }}
            />
            <Stack zIndex={1}>
              <Heading size="$heading4xl" textAlign="center">
                {intl.formatMessage({
                  id: ETranslations.onboarding_welcome_message,
                })}
              </Heading>
              <SizableText
                size="$bodyLg"
                textAlign="center"
                color="$textSubdued"
              >
                {intl.formatMessage({
                  id: ETranslations.onboarding_welcome_description,
                })}
              </SizableText>
            </Stack>
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
          <ActionsGroup
            items={[
              {
                iconName: platformEnv.isNative
                  ? 'BluetoothOutline'
                  : 'UsbOutline',
                label: intl.formatMessage({
                  id: ETranslations.global_connect_hardware_wallet,
                }),
                primary: true,
                onPress: handleConnectHardwareWallet,
                testID: 'hardware-wallet',
              },
            ]}
          />
          {!isDappMode ? (
            <ActionsGroup
              items={[
                {
                  iconName: 'PlusCircleOutline',
                  label: intl.formatMessage({
                    id: ETranslations.global_create_wallet,
                  }),
                  onPress: handleCreateWalletPress,
                  testID: 'create-wallet',
                },
                {
                  iconName: 'ArrowBottomCircleOutline',
                  label: intl.formatMessage({
                    id: ETranslations.global_import_wallet,
                  }),
                  onPress: handleImportWalletPress,
                  testID: 'import-wallet',
                },
              ]}
            />
          ) : null}
          {isDappMode ? (
            <ActionsGroup
              items={[
                {
                  iconName: 'Link2Outline',
                  label: intl.formatMessage({
                    id: ETranslations.global_connect_wallet,
                  }),
                  onPress: handleConnectWalletPress,
                  testID: '3rd-party-wallet',
                },
                {
                  iconName: 'EyeOutline',
                  label: intl.formatMessage({
                    id: ETranslations.global_track_any_address,
                  }),
                  onPress: handleTrackAnyAddressPress,
                  testID: 'track-any-address',
                },
              ]}
            />
          ) : (
            <ActionsGroup
              items={[
                {
                  iconName: 'Link2Outline',
                  label: intl.formatMessage({
                    id: ETranslations.global_connect_wallet,
                  }),
                  onPress: handleConnectWalletPress,
                  testID: '3rd-party-wallet',
                },
              ]}
            />
          )}
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
            href={termsLink}
            size="$bodySm"
            color="$text"
            target="_blank"
            textDecorationLine="none"
          >
            Terms
          </Anchor>{' '}
          &{' '}
          <Anchor
            href={privacyLink}
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
