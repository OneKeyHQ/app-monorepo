import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Page, Stack, useMedia } from '@onekeyhq/components';
import { TermsAndPrivacy } from '@onekeyhq/kit/src/views/Onboarding/pages/GetStarted/components/TermsAndPrivacy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector/actions';
import { AccountSelectorProviderMirror } from '../AccountSelector';

import {
  ExternalWalletList,
  WalletConnectListItemComponent,
} from './ExternalWalletList';

const sceneName = EAccountSelectorSceneName.home;
const num = 0;

function ConnectWalletContent() {
  const intl = useIntl();
  const media = useMedia();
  const actions = useAccountSelectorActions();

  useEffect(() => {
    void actions.current.autoSelectNextAccount({
      sceneName,
      num,
    });
  }, [actions]);

  const isMobile = media.md;

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_connect_wallet,
        })}
      />
      <Page.Body>
        <Stack flex={1} justifyContent="space-between">
          {isMobile ? (
            <Stack p="$5" gap="$4">
              <WalletConnectListItemComponent
                impl="evm"
                py="$4"
                px="$5"
                mx="$0"
                bg="$bgSubdued"
              />
            </Stack>
          ) : (
            <ExternalWalletList impl="evm" />
          )}
          <TermsAndPrivacy contentContainerProps={{ pb: '$6' }} />
        </Stack>
      </Page.Body>
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
