import { Page, ScrollView, YStack } from '@onekeyhq/components';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { InviteeRewardContent } from './InviteeRewardContent';

function InviteeRewardModalContent() {
  const [selectedAccount] = usePerpsActiveAccountAtom();
  const walletAddress = selectedAccount?.accountAddress ?? '';

  return (
    <Page>
      <Page.Header title="Invitee Reward" />
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
