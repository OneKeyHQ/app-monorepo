import { useState } from 'react';

import { useIntl } from 'react-intl';

import { AnimatePresence, Page, YStack, useMedia } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferAFriendHowToPhase } from './components/ReferAFriendHowToPhase';
import { ReferAFriendIntroPhase } from './components/ReferAFriendIntroPhase';
import { useReferAFriendData } from './hooks/useReferAFriendData';
import { EPhaseState } from './types';

interface IReferAFriendPageProps {
  postConfig: IInvitePostConfig;
}

function ReferAFriendPage({ postConfig }: IReferAFriendPageProps) {
  const [phaseState, setPhaseState] = useState<EPhaseState | undefined>(
    EPhaseState.next,
  );

  return (
    <YStack $gtMd={{ py: '$5' }} pb="$5" maxWidth={640} mx="auto" flex={1}>
      <AnimatePresence exitBeforeEnter>
        {phaseState === EPhaseState.next ? (
          <YStack
            key="intro-phase"
            animation="quick"
            enterStyle={{
              opacity: 0,
            }}
            exitStyle={{
              opacity: 0,
            }}
          >
            <ReferAFriendIntroPhase
              postConfig={postConfig}
              setPhaseState={setPhaseState}
            />
          </YStack>
        ) : null}
        {phaseState === EPhaseState.join ? (
          <YStack
            key="howto-phase"
            animation="quick"
            enterStyle={{
              opacity: 0,
            }}
            exitStyle={{
              opacity: 0,
            }}
          >
            <ReferAFriendHowToPhase setPhaseState={setPhaseState} />
          </YStack>
        ) : null}
      </AnimatePresence>
    </YStack>
  );
}

function ReferAFriendPageWrapper() {
  const intl = useIntl();
  const { md } = useMedia();
  const { postConfig } = useReferAFriendData();

  return (
    <Page scrollEnabled>
      {platformEnv.isNative || md ? (
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.sidebar_refer_a_friend,
          })}
        />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
        />
      )}
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
