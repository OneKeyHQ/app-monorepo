import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, Stack, Tabs, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { TermsAndPrivacy } from '@onekeyhq/kit/src/views/Onboarding/pages/GetStarted/components/TermsAndPrivacy';
import { useImportAddressForm } from '@onekeyhq/kit/src/views/Onboarding/pages/ImportWallet/hooks/useImportAddressForm';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  type EOnboardingPages,
  ERootRoutes,
  type IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector/actions';
import { AccountSelectorProviderMirror } from '../AccountSelector';

import { ExternalWalletList } from './ExternalWalletList';
import { OneKeyWalletConnectionOptions } from './OneKeyWalletConnectionOptions';
import { WatchOnlyWalletContent } from './WatchOnlyWalletContent';

import type { RouteProp } from '@react-navigation/core';

const sceneName = EAccountSelectorSceneName.home;
const num = 0;

function ConnectWalletContent() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IOnboardingParamList, EOnboardingPages.ConnectWalletOptions>
    >();
  const { defaultTab } = route.params || {};
  const media = useMedia();
  const actions = useAccountSelectorActions();

  useEffect(() => {
    void actions.current.autoSelectNextAccount({
      sceneName,
      num,
    });
  }, [actions]);

  const isMobile = media.md;

  const onekeyTitle = intl.formatMessage({
    id: ETranslations.global_onekey_wallet,
  });
  const othersTitle = intl.formatMessage({
    id: ETranslations.global_others,
  });
  const watchOnlyTitle = intl.formatMessage({
    id: ETranslations.global_watch_only_wallet,
  });

  const showWatchOnlyTab = !platformEnv.isWeb;

  const initialTabName = useMemo(() => {
    return defaultTab === 'others' ? othersTitle : onekeyTitle;
  }, [defaultTab, othersTitle, onekeyTitle]);

  const [activeTabIndex, setActiveTabIndex] = useState<number>(() => {
    return defaultTab === 'others' ? 1 : 0;
  });

  const handleWalletAdded = useCallback(() => {
    navigation.navigate(ERootRoutes.Main, undefined, {
      pop: true,
    });
  }, [navigation]);

  // Watch-only wallet form state
  const watchOnlyFormState = useImportAddressForm({
    onWalletAdded: handleWalletAdded,
  });

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
            <OneKeyWalletConnectionOptions showInModal={false} />
          </Stack>
        </Tabs.Tab>
        <Tabs.Tab name={othersTitle}>
          <ExternalWalletList impl="evm" />
        </Tabs.Tab>
        {showWatchOnlyTab ? (
          <Tabs.Tab name={watchOnlyTitle}>
            <WatchOnlyWalletContent {...watchOnlyFormState} />
          </Tabs.Tab>
        ) : null}
      </Tabs.Container>
    ),
    [
      onekeyTitle,
      othersTitle,
      watchOnlyTitle,
      watchOnlyFormState,
      initialTabName,
      showWatchOnlyTab,
    ],
  );

  return (
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
              <OneKeyWalletConnectionOptions showInModal />
            </Stack>
          ) : (
            // Desktop: show full tabs
            renderTabs
          )}
          {activeTabIndex === 2 ? null : (
            <TermsAndPrivacy contentContainerProps={{ pb: '$6' }} />
          )}
        </Stack>
      </Page.Body>
      {activeTabIndex === 2 ? (
        <Page.Footer
          confirmButtonProps={{
            disabled: !watchOnlyFormState.isEnable,
          }}
          onConfirm={watchOnlyFormState.form.submit}
        />
      ) : null}
    </Page>
  );
}

function ConnectWalletModal() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName,
      }}
      enabledNum={[num]}
    >
      <ConnectWalletContent />
    </AccountSelectorProviderMirror>
  );
}

export { ConnectWalletModal };
export default ConnectWalletModal;
