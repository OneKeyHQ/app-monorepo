import { useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Page,
  Stack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { LazyPageContainer } from '@onekeyhq/kit/src/components/LazyPageContainer';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInvitePostConfig } from '@onekeyhq/shared/src/referralCode/type';
import {
  EModalReferFriendsRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferFriendsPageContainer } from '../../components';

import { ReferAFriendHowToPhase } from './components/ReferAFriendHowToPhase';
import { ReferAFriendIntroPhase } from './components/ReferAFriendIntroPhase';
import { ReferAFriendPhaseActions } from './components/ReferAFriendPhaseActions';
import { useReferAFriendData } from './hooks/useReferAFriendData';
import { EPhaseState } from './types';

interface IReferAFriendPageProps {
  postConfig: IInvitePostConfig;
  phaseState: EPhaseState | undefined;
  setPhaseState: (state: EPhaseState | undefined) => void;
  showInlineActions: boolean;
}

function ReferAFriendPage({
  postConfig,
  phaseState,
  setPhaseState,
  showInlineActions,
}: IReferAFriendPageProps) {
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
              actions={
                showInlineActions ? (
                  <ReferAFriendPhaseActions
                    phaseState={phaseState}
                    setPhaseState={setPhaseState}
                  />
                ) : undefined
              }
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
            <ReferAFriendHowToPhase
              actions={
                showInlineActions ? (
                  <ReferAFriendPhaseActions
                    phaseState={phaseState}
                    setPhaseState={setPhaseState}
                  />
                ) : undefined
              }
            />
          </YStack>
        ) : null}
      </AnimatePresence>
    </YStack>
  );
}

function ReferAFriendPageWrapper() {
  const intl = useIntl();
  const route = useRoute();
  const { md } = useMedia();
  const { postConfig } = useReferAFriendData();
  const [phaseState, setPhaseState] = useState<EPhaseState | undefined>(
    EPhaseState.next,
  );

  // Check if opened as Modal (window mode) by route name
  const isModalMode = route.name === EModalReferFriendsRoutes.ReferAFriend;

  const showInlineActions = !isModalMode;
  const shouldShowFooter = !showInlineActions && !!postConfig && !!phaseState;

  return (
    <Page scrollEnabled>
      {platformEnv.isNative || isModalMode || md ? (
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.sidebar_refer_a_friend,
          })}
        />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
          hideHeaderLeft={platformEnv.isDesktop}
        />
      )}
      <Page.Body>
        <ReferFriendsPageContainer flex={1}>
          {postConfig ? (
            <ReferAFriendPage
              postConfig={postConfig}
              phaseState={phaseState}
              setPhaseState={setPhaseState}
              showInlineActions={showInlineActions}
            />
          ) : null}
        </ReferFriendsPageContainer>
      </Page.Body>

      {shouldShowFooter ? (
        <Page.Footer>
          <Stack px="$4" py="$4" bg="$bgApp">
            <ReferAFriendPhaseActions
              placement="footer"
              phaseState={phaseState}
              setPhaseState={setPhaseState}
            />
          </Stack>
        </Page.Footer>
      ) : null}
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
      <LazyPageContainer>
        <ReferAFriendPageWrapper />
      </LazyPageContainer>
    </AccountSelectorProviderMirror>
  );
}
