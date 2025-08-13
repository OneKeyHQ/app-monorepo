import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, Stack, Tabs } from '@onekeyhq/components';
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

import type { RouteProp } from '@react-navigation/core';

function ConnectWalletModal() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IOnboardingParamList, EOnboardingPages.ConnectWalletOptions>
    >();
  const { defaultTab } = route.params || {};

  const onekeyTitle = intl.formatMessage({
    id: ETranslations.global_onekey_wallet,
  });
  const othersTitle = intl.formatMessage({
    id: ETranslations.global_others,
  });

  const initialTabName = useMemo(() => {
    return defaultTab === 'others' ? othersTitle : onekeyTitle;
  }, [defaultTab, othersTitle, onekeyTitle]);

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
            <Tabs.Container initialTabName={initialTabName}>
              <Tabs.Tab name={onekeyTitle}>
                <Stack p="$5" gap="$4">
                  <OneKeyWalletConnectionOptions />
                </Stack>
              </Tabs.Tab>
              <Tabs.Tab name={othersTitle}>
                <ExternalWalletList impl="evm" />
              </Tabs.Tab>
            </Tabs.Container>
            <TermsAndPrivacy />
          </Stack>
        </Page.Body>
      </Page>
    </AccountSelectorProviderMirror>
  );
}

export { ConnectWalletModal };
export default ConnectWalletModal;
