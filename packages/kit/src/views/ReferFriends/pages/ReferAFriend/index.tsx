import { useState } from 'react';
import type { ReactNode } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Page,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
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

import { InviteCodeStepImage } from './components/InviteCodeStepImage';
import { ReferAFriendHowToPhase } from './components/ReferAFriendHowToPhase';
import { ReferAFriendIntroPhase } from './components/ReferAFriendIntroPhase';
import { ReferAFriendPhaseActions } from './components/ReferAFriendPhaseActions';
import { useReferAFriendData } from './hooks/useReferAFriendData';
import { EPhaseState } from './types';

interface IReferAFriendPageProps {
  postConfig: IInvitePostConfig;
  phaseState: EPhaseState;
  actions?: ReactNode;
}

// Both phase texts share one row cell (the second pulls back with a -100%
// margin), so the row is always as tall as the taller phase and the actions
// below never move. The hidden phase is transparent and non-interactive.
function PhaseLayer({
  isActive,
  overlapPrevious,
  children,
}: {
  isActive: boolean;
  overlapPrevious?: boolean;
  children: ReactNode;
}) {
  return (
    <Stack
      w="100%"
      flexShrink={0}
      ml={overlapPrevious ? '-100%' : undefined}
      opacity={isActive ? 1 : 0}
      pointerEvents={isActive ? 'auto' : 'none'}
      aria-hidden={!isActive}
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY}
    >
      {children}
    </Stack>
  );
}

function ReferAFriendPage({
  postConfig,
  phaseState,
  actions,
}: IReferAFriendPageProps) {
  const isIntro = phaseState === EPhaseState.next;
  return (
    <YStack
      $gtMd={{ py: '$5' }}
      pb="$5"
      gap="$5"
      flex={1}
      justifyContent="center"
    >
      <AnimatePresence exitBeforeEnter>
        <Stack
          key={phaseState}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        >
          <InviteCodeStepImage step={isIntro ? 1 : 2} />
        </Stack>
      </AnimatePresence>
      <XStack>
        <PhaseLayer isActive={isIntro}>
          <ReferAFriendIntroPhase postConfig={postConfig} />
        </PhaseLayer>
        <PhaseLayer isActive={!isIntro} overlapPrevious>
          <ReferAFriendHowToPhase postConfig={postConfig} />
        </PhaseLayer>
      </XStack>
      {actions ? (
        <Stack maxWidth={480} w="100%" mx="auto" mt="$5">
          {actions}
        </Stack>
      ) : null}
    </YStack>
  );
}

function ReferAFriendPageWrapper() {
  const intl = useIntl();
  const route = useRoute();
  const { md } = useMedia();
  const { postConfig } = useReferAFriendData();
  const [phaseState, setPhaseState] = useState<EPhaseState>(EPhaseState.next);

  // Check if opened as Modal (window mode) by route name
  const isModalMode = route.name === EModalReferFriendsRoutes.ReferAFriend;
  // Modal (native) pins actions to the footer; tab pages keep them under the text.
  const showInlineActions = !isModalMode;
  const actions = (
    <ReferAFriendPhaseActions
      phaseState={phaseState}
      setPhaseState={setPhaseState}
    />
  );

  return (
    <Page
      scrollEnabled
      scrollProps={{ contentContainerStyle: { flexGrow: 1 } }}
    >
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
        <Page.Container layout="compact" flex={1}>
          {postConfig ? (
            <ReferAFriendPage
              postConfig={postConfig}
              phaseState={phaseState}
              actions={showInlineActions ? actions : undefined}
            />
          ) : null}
        </Page.Container>
      </Page.Body>

      {postConfig && !showInlineActions ? (
        <Page.Footer>
          <Stack px="$4" py="$4" bg="$bgApp">
            {actions}
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
