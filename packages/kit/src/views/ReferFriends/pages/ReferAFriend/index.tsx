import { useState } from 'react';

import { useIntl } from 'react-intl';

import { AnimatePresence, Page, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { useReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferAFriendHowToPhase } from './components/ReferAFriendHowToPhase';
import { ReferAFriendIntroPhase } from './components/ReferAFriendIntroPhase';
import { useReferAFriendData } from './hooks/useReferAFriendData';
import { EPhaseState } from './types';

import type { IReferAFriendPageProps } from './types';

function ReferAFriendPage({ postConfig }: IReferAFriendPageProps) {
  const intl = useIntl();
  const [phaseState, setPhaseState] = useState<EPhaseState | undefined>(
    EPhaseState.next,
  );
  const { toInviteRewardPage } = useReferFriends();

  return (
    <>
      <YStack>
        <AnimatePresence>
          {phaseState === EPhaseState.next ? (
            <ReferAFriendIntroPhase postConfig={postConfig} />
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {phaseState === EPhaseState.join ? <ReferAFriendHowToPhase /> : null}
        </AnimatePresence>
      </YStack>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id:
            phaseState === EPhaseState.next
              ? ETranslations.global_next
              : ETranslations.global_join,
        })}
        onConfirm={async () => {
          if (phaseState === EPhaseState.next) {
            setPhaseState(undefined);
            setTimeout(() => {
              setPhaseState(EPhaseState.join);
            }, 50);
            return;
          }
          await backgroundApiProxy.serviceSpotlight.firstVisitTour(
            ESpotlightTour.referAFriend,
          );
          setTimeout(() => {
            void toInviteRewardPage();
          }, 200);
        }}
      />
    </>
  );
}

function ReferAFriendPageWrapper() {
  const { postConfig } = useReferAFriendData();

  return (
    <Page scrollEnabled>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.ReferFriends}
      />
      <Page.Body>
        {postConfig ? <ReferAFriendPage postConfig={postConfig} /> : null}
      </Page.Body>
    </Page>
  );
}

export default function ReferAFriend() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ReferAFriendPageWrapper />
    </AccountSelectorProviderMirror>
  );
}
