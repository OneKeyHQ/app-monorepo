import { useState } from 'react';

import { AnimatePresence, Page, YStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferAFriendHowToPhase } from './components/ReferAFriendHowToPhase';
import { ReferAFriendIntroPhase } from './components/ReferAFriendIntroPhase';
import { useReferAFriendData } from './hooks/useReferAFriendData';
import { EPhaseState } from './types';

import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';

interface IReferAFriendPageProps {
  postConfig: IInvitePostConfig;
}

function ReferAFriendPage({ postConfig }: IReferAFriendPageProps) {
  const [phaseState, setPhaseState] = useState<EPhaseState | undefined>(
    EPhaseState.next,
  );

  return (
    <YStack maxWidth={1080} mx="auto" flex={1}>
      <AnimatePresence>
        {phaseState === EPhaseState.next ? (
          <ReferAFriendIntroPhase
            postConfig={postConfig}
            setPhaseState={setPhaseState}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {phaseState === EPhaseState.join ? (
          <ReferAFriendHowToPhase setPhaseState={setPhaseState} />
        ) : null}
      </AnimatePresence>
    </YStack>
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
