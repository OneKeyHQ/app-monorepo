import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Page,
  SizableText,
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
import type {
  IPerksOpenEntry,
  IReferralPageTab,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ReferralJobTabs } from '../InviteReward/components/ReferralJobTabs';
import { ReferralTabCrossLink } from '../InviteReward/components/ReferralTabCrossLink';
import {
  EReferralPageTab,
  IS_BENEFITS_TAB_ENABLED,
  resolveReferralPageTab,
} from '../InviteReward/referralPageTab';
import { useReferralTabCopy } from '../InviteReward/referralTabCopy';
import { useReferralTabSwitch } from '../InviteReward/useReferralTabSwitch';
import { MyRewardsContent } from '../MyRewards';

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
  // With the actions pinned to the footer (native modal), the content starts
  // from the top like other onboarding screens, and the spare height falls
  // above the button instead of splitting around the content. Inline actions
  // (tab pages) keep the content and buttons centred as one block.
  const isFooterActions = !actions;
  return (
    <YStack
      $gtMd={{ py: '$5' }}
      pt={isFooterActions ? '$8' : undefined}
      pb="$5"
      gap="$5"
      flex={1}
      justifyContent={isFooterActions ? 'flex-start' : 'center'}
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
  const tabCopy = useReferralTabCopy();
  const intl = useIntl();
  const route = useRoute<{
    key: string;
    name: string;
    params?: { tab?: IReferralPageTab; perksEntry?: IPerksOpenEntry };
  }>();
  const { md } = useMedia();
  const { postConfig } = useReferAFriendData({
    tab: route.params?.tab,
    perksEntry: route.params?.perksEntry,
  });
  const [phaseState, setPhaseState] = useState<EPhaseState>(EPhaseState.next);
  const activeTab = resolveReferralPageTab(route.params?.tab);
  const isInviteTab = activeTab === EReferralPageTab.invite;
  const { setActiveTab, openPerks, openInvite } =
    useReferralTabSwitch(activeTab);
  // The invite intro is a one-way, step-by-step pitch, so it gets no tabs
  // to branch off from; Perks is a quiet link under its actions instead.
  // Once on Perks (that link, or a deep link), the tabs lead back.
  const showTabs = IS_BENEFITS_TAB_ENABLED && !isInviteTab;
  const perksLink = IS_BENEFITS_TAB_ENABLED ? (
    <ReferralTabCrossLink
      pt="$3"
      testID="refer-friends-intro-to-perks-link"
      prompt={tabCopy.toPerksPrompt}
      action={tabCopy.toPerksAction}
      onPress={openPerks}
    />
  ) : null;
  const renderHeaderTitle = useCallback(
    () => (
      <ReferralJobTabs
        variant="compact"
        value={activeTab}
        onChange={setActiveTab}
      />
    ),
    [activeTab, setActiveTab],
  );

  // Check if opened as Modal (window mode) by route name
  const isModalMode = route.name === EModalReferFriendsRoutes.ReferAFriend;
  // Modal (native) pins actions to the footer; tab pages keep them under the text.
  const showInlineActions = !isModalMode;
  const isCompactHeader = platformEnv.isNative || isModalMode || md;
  // Mobile web keeps the global header actions (Connect, search), so the
  // tabs only move into the navigation bar on native and in modals.
  const showTabsInHeader = platformEnv.isNative || isModalMode;
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
      {isCompactHeader ? (
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.sidebar_refer_a_friend,
          })}
          // Where the switch lives in the navigation bar, headerTitle is
          // always passed: the header keeps options it is not given, so
          // dropping it on the way back to the intro left "Perks" showing.
          // An explicit undefined restores the plain title. Mobile web never
          // gets it, as there undefined renders the title over the global
          // header actions.
          {...(IS_BENEFITS_TAB_ENABLED && showTabsInHeader
            ? { headerTitle: showTabs ? renderHeaderTitle : undefined }
            : undefined)}
        />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
          hideHeaderLeft={platformEnv.isDesktop}
        />
      )}
      <Page.Body>
        {showTabs && !showTabsInHeader ? (
          // Same container width as the logged-in page, so the tabs do not
          // move when the user signs in.
          <Page.Container padded={false}>
            <XStack
              px="$pagePadding"
              pt="$5"
              pb="$4"
              ai="center"
              jc="space-between"
              gap="$3"
            >
              <ReferralJobTabs
                value={activeTab}
                onChange={setActiveTab}
                // Mobile web keeps the tabs in the content; it gets the same
                // compact switch as the navigation bar elsewhere.
                variant={md ? 'compact' : 'tabs'}
              />
              {/* Same intro at the right of the tabs as the signed-in page;
                  compact layouts show it atop the Perks content. */}
              {md ? null : (
                <SizableText
                  size="$bodyMd"
                  color="$textSubdued"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {tabCopy.perksIntro}
                </SizableText>
              )}
            </XStack>
          </Page.Container>
        ) : null}
        {isInviteTab ? (
          <Page.Container layout="compact" flex={1}>
            {postConfig ? (
              <ReferAFriendPage
                postConfig={postConfig}
                phaseState={phaseState}
                actions={showInlineActions ? actions : undefined}
              />
            ) : null}
            {postConfig && showInlineActions ? (
              // Pinned to the bottom with the same 24px below as the tabs' links.
              <Stack pb="$6">{perksLink}</Stack>
            ) : null}
          </Page.Container>
        ) : (
          <Page.Container padded={false} flex={1}>
            <MyRewardsContent
              entry={route.params?.perksEntry ?? 'route'}
              onOpenInvite={openInvite}
            />
          </Page.Container>
        )}
      </Page.Body>

      {isInviteTab && postConfig && !showInlineActions ? (
        <Page.Footer>
          <Stack px="$4" py="$4" bg="$bgApp">
            {actions}
            {perksLink}
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
