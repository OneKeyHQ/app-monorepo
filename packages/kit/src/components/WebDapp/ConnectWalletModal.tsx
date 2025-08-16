import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, Stack, Tabs, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { TermsAndPrivacy } from '@onekeyhq/kit/src/views/Onboarding/pages/GetStarted/components/TermsAndPrivacy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EOnboardingPages,
  IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../AccountSelector';

import { ExternalWalletList } from './ExternalWalletList';
import { OneKeyWalletConnectionOptions } from './OneKeyWalletConnectionOptions';
import { WatchOnlyWalletContent } from './WatchOnlyWalletContent';

import type { RouteProp } from '@react-navigation/core';

function ConnectWalletModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IOnboardingParamList, EOnboardingPages.ConnectWalletOptions>
    >();
  const { defaultTab } = route.params || {};
  const media = useMedia();

  const isMobile = media.md;

  const onekeyTitle = intl.formatMessage({
    id: ETranslations.global_onekey_wallet,
  });
  const othersTitle = intl.formatMessage({
    id: ETranslations.global_others,
  });
  const watchOnlyTitle = intl.formatMessage({
    id: ETranslations.global_watch_only,
  });

  const initialTabName = useMemo(() => {
    return defaultTab === 'others' ? othersTitle : onekeyTitle;
  }, [defaultTab, othersTitle, onekeyTitle]);

  const [activeTabIndex, setActiveTabIndex] = useState<number>(() => {
    return defaultTab === 'others' ? 1 : 0;
  });

  const handleWalletAdded = useCallback(() => {
    navigation.popStack();
  }, [navigation]);

  const renderTabs = useMemo(
    () => (
      <Tabs.Container
        initialTabName={initialTabName}
        onIndexChange={(index) => {
          setActiveTabIndex(index);
        }}
      >
        <Tabs.Tab name={onekeyTitle}>
          <Stack p="$5" gap="$4">
            <OneKeyWalletConnectionOptions />
          </Stack>
        </Tabs.Tab>
        <Tabs.Tab name={othersTitle}>
          <ExternalWalletList impl="evm" />
        </Tabs.Tab>
        <Tabs.Tab name={watchOnlyTitle}>
          <WatchOnlyWalletContent onWalletAdded={handleWalletAdded} />
        </Tabs.Tab>
      </Tabs.Container>
    ),
    [
      onekeyTitle,
      othersTitle,
      watchOnlyTitle,
      handleWalletAdded,
      initialTabName,
    ],
  );

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <Page>
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.global_connect_wallet,
          })}
        />
        <Page.Body>
          <Stack flex={1}>
            {isMobile ? (
              // Mobile: show simplified view without tabs
              <Stack p="$5" gap="$4" flex={1}>
                <OneKeyWalletConnectionOptions />
              </Stack>
            ) : (
              // Desktop: show full tabs
              renderTabs
            )}
            {activeTabIndex === 2 ? null : <TermsAndPrivacy />}
          </Stack>
        </Page.Body>
      </Page>
    </AccountSelectorProviderMirror>
  );
}

export { ConnectWalletModal };
export default ConnectWalletModal;
