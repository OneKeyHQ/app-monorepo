import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Icon,
  SizableText,
  Spinner,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EOnboardingPages,
  EOnboardingPagesV2,
} from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useUserWalletProfile } from '../../../hooks/useUserWalletProfile';
import useLiteCard from '../../LiteCard/hooks/useLiteCard';
import {
  OnboardingHeading,
  OnboardingOrDivider,
  OnboardingPage,
  OnboardingSidebar,
} from '../components/Layout';
import { useCloudBackup } from '../hooks/useCloudBackup';
import { useKeylessLocalExistenceLogin } from '../hooks/useKeylessLocalExistenceLogin';

type IImportOption = {
  key: string;
  title: string;
  icon: IKeyOfIcons;
  onPress: () => void | Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
};

const listItemNativePressableStyle = { flexShrink: 0 } as const;

const HIGHEST_PRIORITY_KEYS = new Set(['google', 'apple']);
const MEDIUM_PRIORITY_KEYS = new Set(['phraseOrPrivateKey']);

const isGroup1 = (key: string) =>
  HIGHEST_PRIORITY_KEYS.has(key) || MEDIUM_PRIORITY_KEYS.has(key);

function CreateOrImportWallet() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const liteCard = useLiteCard();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const {
    enableKeylessWalletLoading,
    loadingProvider,
    handleGoogleLogin,
    handleAppleLogin,
  } = useKeylessLocalExistenceLogin();

  const {
    checkLoading: cloudBackupCheckLoading,
    supportCloudBackup,
    goToPageBackupList,
    cloudBackupFeatureInfo,
  } = useCloudBackup();

  const { result: cloudOption = null } = usePromiseResult<{
    title: string;
    icon: IKeyOfIcons;
  } | null>(async () => {
    if (!supportCloudBackup || !cloudBackupFeatureInfo) {
      return null;
    }
    return {
      title: cloudBackupFeatureInfo.title,
      icon: cloudBackupFeatureInfo.icon as IKeyOfIcons,
    };
  }, [supportCloudBackup, cloudBackupFeatureInfo]);

  const handleImportPhraseOrPrivateKey = useCallback(() => {
    navigation.push(EOnboardingPagesV2.ImportPhraseOrPrivateKey);
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'ImportWallet',
      details: { importType: 'importPhraseOrPrivateKey' },
      isSoftwareWalletOnlyUser,
    });
  }, [navigation, isSoftwareWalletOnlyUser]);

  const handleImportByTransfer = useCallback(() => {
    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeTransfer,
    });
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'ImportWallet',
      details: { importType: 'transfer' },
      isSoftwareWalletOnlyUser,
    });
  }, [navigation, isSoftwareWalletOnlyUser]);

  const handleImportKeyTag = useCallback(async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    // V2 ImportKeyTag page exists but the V1 modal flow is the production path.
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportKeyTag,
    });
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'ImportWallet',
      details: { importType: 'keyTag' },
      isSoftwareWalletOnlyUser,
    });
  }, [navigation, isSoftwareWalletOnlyUser]);

  const handleImportByLite = useCallback(async () => {
    await liteCard.importWallet();
    defaultLogger.account.wallet.addWalletStarted({
      addMethod: 'ImportWallet',
      details: { importType: 'lite' },
      isSoftwareWalletOnlyUser,
    });
  }, [liteCard, isSoftwareWalletOnlyUser]);

  const handleConnectExternalWallet = useCallback(() => {
    // V2 ConnectWalletSelectNetworks is incomplete; use V1 modal.
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectWalletSelectNetworks,
    });
    defaultLogger.account.wallet.onboard({
      onboardMethod: 'connect3rdPartyWallet',
    });
  }, [navigation]);

  const handleImportWatchedAccount = useCallback(() => {
    // V2 ImportWatchedAccount exists but V1 modal carries production behavior.
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportAddress,
      params: {
        isFromOnboardingV2: true,
      },
    });
  }, [navigation]);

  const options: IImportOption[] = useMemo(() => {
    const isGoogleLoading =
      enableKeylessWalletLoading &&
      loadingProvider === EOAuthSocialLoginProvider.Google;
    const isAppleLoading =
      enableKeylessWalletLoading &&
      loadingProvider === EOAuthSocialLoginProvider.Apple;

    return [
      {
        key: 'google',
        icon: 'GoogleIllus',
        title: intl.formatMessage(
          { id: ETranslations.continue_with_social_platform },
          { platform: 'Google' },
        ),
        onPress: handleGoogleLogin,
        isLoading: isGoogleLoading,
        disabled: enableKeylessWalletLoading,
      },
      {
        key: 'apple',
        icon: 'AppleBrand',
        title: intl.formatMessage(
          { id: ETranslations.continue_with_social_platform },
          { platform: 'Apple' },
        ),
        onPress: handleAppleLogin,
        isLoading: isAppleLoading,
        disabled: enableKeylessWalletLoading,
      },
      {
        key: 'phraseOrPrivateKey',
        icon: 'SecretPhraseOutline',
        title: intl.formatMessage({
          id: ETranslations.import_phrase_or_private_key,
        }),
        onPress: handleImportPhraseOrPrivateKey,
      },
      {
        key: 'external',
        icon: 'LinkOutline',
        title: intl.formatMessage({
          id: ETranslations.onboarding_connect_external_wallet,
        }),
        onPress: handleConnectExternalWallet,
      },
      {
        key: 'transfer',
        icon: 'MultipleDevicesOutline',
        title: intl.formatMessage({ id: ETranslations.transfer_transfer }),
        onPress: handleImportByTransfer,
      },
      cloudOption
        ? {
            key: 'cloud',
            icon: cloudOption.icon,
            title: cloudOption.title,
            onPress: goToPageBackupList,
            isLoading: cloudBackupCheckLoading,
          }
        : null,
      platformEnv.isNative
        ? {
            key: 'lite',
            icon: 'OnekeyLiteOutline',
            title: 'OneKey Lite',
            onPress: handleImportByLite,
          }
        : null,
      {
        key: 'keytag',
        icon: 'OnekeyKeytagOutline',
        title: 'OneKey KeyTag',
        onPress: handleImportKeyTag,
      },
      {
        key: 'watch',
        icon: 'EyeOutline',
        title: intl.formatMessage({
          id: ETranslations.global_watch_only_address,
        }),
        onPress: handleImportWatchedAccount,
      },
    ].filter(Boolean) as IImportOption[];
  }, [
    intl,
    enableKeylessWalletLoading,
    loadingProvider,
    handleGoogleLogin,
    handleAppleLogin,
    handleImportPhraseOrPrivateKey,
    handleImportByTransfer,
    cloudOption,
    goToPageBackupList,
    cloudBackupCheckLoading,
    handleImportKeyTag,
    handleImportByLite,
    handleConnectExternalWallet,
    handleImportWatchedAccount,
  ]);

  const { gtMd } = useMedia();

  const highestPriorityOptions = options.filter((o) =>
    HIGHEST_PRIORITY_KEYS.has(o.key),
  );
  const mediumPriorityOptions = options.filter((o) =>
    MEDIUM_PRIORITY_KEYS.has(o.key),
  );
  const secondaryOptions = options.filter((o) => !isGroup1(o.key));

  const renderPrimaryButton = ({
    key,
    icon,
    title,
    onPress,
    isLoading,
    disabled,
  }: IImportOption) => {
    const isPrimary = HIGHEST_PRIORITY_KEYS.has(key);
    return (
      <Button
        key={key}
        variant={isPrimary ? 'primary' : 'secondary'}
        size="large"
        alignSelf="stretch"
        childrenAsText={false}
        disabled={disabled}
        onPress={onPress}
      >
        <YStack position="absolute" left="$5">
          {isLoading ? (
            <Spinner size="small" />
          ) : (
            <Icon
              name={icon}
              size="$6"
              color={isPrimary ? '$iconInverse' : '$icon'}
              $gtMd={{
                size: '$5',
              }}
            />
          )}
        </YStack>
        <SizableText
          size="$bodyLgMedium"
          color={isPrimary ? '$textInverse' : '$text'}
        >
          {title}
        </SizableText>
      </Button>
    );
  };

  const renderSecondaryItem = ({
    key,
    icon,
    title,
    onPress,
    isLoading,
    disabled,
  }: IImportOption) => (
    <ListItem
      key={key}
      icon={icon}
      title={title}
      drillIn
      onPress={onPress}
      isLoading={isLoading}
      disabled={disabled}
      nativePressableStyle={listItemNativePressableStyle}
    />
  );

  return (
    <OnboardingPage scrollable>
      <YStack $gtMd={{ flexDirection: 'row' }}>
        <YStack gap="$8" $gtMd={{ flex: 1, gap: '$12' }}>
          <OnboardingHeading>
            {intl.formatMessage({ id: ETranslations.add_existing_wallet })}
          </OnboardingHeading>
          <YStack
            gap="$3"
            $gtMd={{
              gap: '$5',
            }}
          >
            {highestPriorityOptions.map(renderPrimaryButton)}
            {gtMd ? <OnboardingOrDivider /> : null}
            {mediumPriorityOptions.map(renderPrimaryButton)}
          </YStack>
        </YStack>
        <OnboardingSidebar gap="$2" $md={{ mt: '$12' }}>
          <SizableText
            size="$bodyLg"
            color="$textSubdued"
            px="$5"
            $gtMd={{
              px: '$0',
              pb: '$6',
            }}
            lineHeight={40}
          >
            {intl.formatMessage({ id: ETranslations.more_options })}
          </SizableText>
          <YStack
            $gtMd={{
              mx: '$-5',
            }}
          >
            {secondaryOptions.map(renderSecondaryItem)}
          </YStack>
        </OnboardingSidebar>
      </YStack>
    </OnboardingPage>
  );
}

function CreateOrImportWalletWithContext() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <CreateOrImportWallet />
    </AccountSelectorProviderMirror>
  );
}

export default CreateOrImportWalletWithContext;
