import { useIntl } from 'react-intl';

import type {
  IKeyOfIcons,
  IPageScreenProps,
  IXStackProps,
} from '@onekeyhq/components';
import {
  Divider,
  Group,
  Heading,
  Icon,
  IconButton,
  Image,
  LinearGradient,
  Page,
  SizableText,
  Spinner,
  Stack,
  ThemeableStack,
  View,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MultipleClickStack } from '@onekeyhq/kit/src/components/MultipleClickStack';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { TermsAndPrivacy } from './components/TermsAndPrivacy';

type IActionsGroupItem = {
  iconName: IKeyOfIcons;
  label: string;
  primary?: boolean;
  isLoading?: boolean;
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
            focusVisibleStyle={{
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
            {item?.isLoading ? (
              <XStack ml="$2">
                <Spinner />
              </XStack>
            ) : null}
          </XStack>
        </Group.Item>
      ))}
    </Group>
  );
}

export function GetStarted({
  route,
}: IPageScreenProps<IOnboardingParamList, EOnboardingPages.GetStarted>) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { top } = useSafeAreaInsets();
  let { showCloseButton } = route.params || {};
  if (process.env.NODE_ENV !== 'production') {
    showCloseButton = true;
  }

  const handleCreateWalletPress = async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    navigation.push(EOnboardingPages.BeforeShowRecoveryPhrase);
    defaultLogger.account.wallet.onboard({ onboardMethod: 'createWallet' });
  };

  const handleImportWalletPress = async () => {
    navigation.push(EOnboardingPages.ImportWalletOptions);
    defaultLogger.account.wallet.onboard({ onboardMethod: 'importWallet' });
  };

  const handleConnectHardwareWallet = async () => {
    navigation.push(EOnboardingPages.ConnectYourDevice);
    defaultLogger.account.wallet.onboard({ onboardMethod: 'connectHWWallet' });
  };

  const handleConnectWalletPress = async () => {
    navigation.push(EOnboardingPages.ConnectWalletSelectNetworks);
    defaultLogger.account.wallet.onboard({
      onboardMethod: 'connect3rdPartyWallet',
    });
  };

  const handleTrackAnyAddressPress = async () => {
    navigation.push(EOnboardingPages.ImportAddress);
  };

  const isDappMode = platformEnv.isWebDappMode;

  return (
    <Page safeAreaEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        {/* Title and description */}
        <Stack flex={1}>
          <ThemeableStack
            fullscreen
            alignItems="center"
            justifyContent="center"
          >
            <MultipleClickStack
              onPress={() => {
                void navigation.popStack();
              }}
            >
              <Image
                w={360}
                h={360}
                source={require('@onekeyhq/kit/assets/logo-press.png')}
              />
            </MultipleClickStack>
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

        {/* Actions */}
        <Stack
          py="$6"
          px="$5"
          gap="$2.5"
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

        <TermsAndPrivacy />

        {showCloseButton ? (
          <View position="absolute" left="$5" top={top || '$5'}>
            <Page.Close>
              <IconButton icon="CrossedLargeOutline" variant="tertiary" />
            </Page.Close>
          </View>
        ) : null}
      </Page.Body>
    </Page>
  );
}

export default GetStarted;
