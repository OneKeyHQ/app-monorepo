import { useIntl } from 'react-intl';

import { Page, ScrollView, YStack } from '@onekeyhq/components';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { InviteeRewardContent } from './InviteeRewardContent';

function InviteeRewardModalContent() {
  const intl = useIntl();
  const [selectedAccount] = usePerpsActiveAccountAtom();
  const walletAddress = selectedAccount?.accountAddress ?? '';

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.perps_trade_reward,
        })}
      />
      <Page.Body>
        <ScrollView flex={1}>
          <YStack flex={1}>
            <InviteeRewardContent walletAddress={walletAddress} isMobile />
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

function InviteeRewardModalWithProvider() {
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror>
        <InviteeRewardModalContent />
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}

export default InviteeRewardModalWithProvider;
