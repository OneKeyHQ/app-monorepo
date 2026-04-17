import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, YStack } from '@onekeyhq/components';
import { generateMnemonic } from '@onekeyhq/core/src/secret';
import { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  LayoutHeader,
  LayoutHeaderBack,
  LayoutHeaderLanguageSelector,
} from '../components/Layout';
import { useAutoStartKeylessProvider } from '../hooks/useAutoStartKeylessProvider';
import { useKeylessLocalExistenceLogin } from '../hooks/useKeylessLocalExistenceLogin';

import type { RouteProp } from '@react-navigation/core';

function CreateNewWallet() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.CreateNewWallet>
    >();

  const autoLoginKeylessProvider = route?.params?.autoLoginKeylessProvider;
  const autoConnectNonce = route?.params?.autoConnectNonce;
  const isWebKeylessSidePanelMode = Boolean(
    route?.params?.fromExt && autoLoginKeylessProvider,
  );

  const {
    enableKeylessWalletLoading,
    loadingProvider,
    handleGoogleLogin,
    handleAppleLogin,
  } = useKeylessLocalExistenceLogin({ autoLoginKeylessProvider });

  const handleCreateSeedPhraseWallet = useCallback(async () => {
    await backgroundApiProxy.servicePassword.promptPasswordVerify();
    const mnemonic = generateMnemonic();
    const encodedMnemonic =
      await backgroundApiProxy.servicePassword.encodeSensitiveText({
        text: mnemonic,
      });
    navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
      mnemonic: encodedMnemonic,
      isWalletBackedUp: false,
    });
    defaultLogger.account.wallet.onboard({ onboardMethod: 'createWallet' });
  }, [navigation]);

  useAutoStartKeylessProvider({
    autoStartProvider: autoLoginKeylessProvider,
    autoStartTriggerKey: autoConnectNonce,
    enabled: !enableKeylessWalletLoading,
    onGoogleLogin: handleGoogleLogin,
    onAppleLogin: handleAppleLogin,
  });

  const isGoogleLoading =
    enableKeylessWalletLoading &&
    loadingProvider === EOAuthSocialLoginProvider.Google;
  const isAppleLoading =
    enableKeylessWalletLoading &&
    loadingProvider === EOAuthSocialLoginProvider.Apple;

  return (
    <Page>
      <LayoutHeader>
        <LayoutHeaderBack />
        <LayoutHeaderLanguageSelector />
      </LayoutHeader>
      <YStack px="$5" gap="$2">
        <ListItem
          icon="GoogleIllus"
          title={intl.formatMessage(
            { id: ETranslations.continue_with_social_platform },
            { platform: 'Google' },
          )}
          drillIn
          isLoading={isGoogleLoading}
          disabled={enableKeylessWalletLoading}
          onPress={handleGoogleLogin}
        />
        <ListItem
          icon="AppleBrand"
          title={intl.formatMessage(
            { id: ETranslations.continue_with_social_platform },
            { platform: 'Apple' },
          )}
          drillIn
          isLoading={isAppleLoading}
          disabled={enableKeylessWalletLoading}
          onPress={handleAppleLogin}
        />
        {isWebKeylessSidePanelMode ? null : (
          <ListItem
            icon="SecretPhraseOutline"
            title={intl.formatMessage({
              id: ETranslations.create_seed_phrase_wallet,
            })}
            drillIn
            onPress={handleCreateSeedPhraseWallet}
          />
        )}
      </YStack>
    </Page>
  );
}

function CreateNewWalletWithContext() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <CreateNewWallet />
    </AccountSelectorProviderMirror>
  );
}

export default CreateNewWalletWithContext;
