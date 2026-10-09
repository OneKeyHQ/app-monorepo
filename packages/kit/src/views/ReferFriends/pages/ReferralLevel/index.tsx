import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Page,
  ScrollView,
  SizableText,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  BreadcrumbSection,
  ReferFriendsLoadError,
  ReferFriendsPageContainer,
} from '../../components';
import { ReferFriendsTestIDs } from '../../testIDs';
import {
  INVITE_CARD_BORDER_COLOR,
  useInviteListCardStyle,
} from '../InviteReward/components/useInviteCardStyle';

import { LevelListSection } from './components/LevelListSection';
import { LevelStatusCard } from './components/LevelStatusCard';
import { getLevelOverview } from './getLevelOverview';

function ReferralLevelContent({ data }: { data: IInviteLevelDetail }) {
  const intl = useIntl();
  const overview = useMemo(() => getLevelOverview(data), [data]);
  const { currentLevel, nextLevel, retentionStatus, upgradeTargets } = overview;

  return (
    <ScrollView>
      <ReferFriendsPageContainer>
        <YStack py="$5" px="$pagePadding" gap="$4">
          <BreadcrumbSection
            secondItemLabel={intl.formatMessage({
              id: ETranslations.referral_referral_level,
            })}
          />
          {currentLevel ? (
            <LevelStatusCard
              level={currentLevel}
              retentionStatus={retentionStatus}
              nextLevel={nextLevel}
              upgradeTargets={upgradeTargets}
            />
          ) : null}
          {/* Every level's conditions and rates; the current level's progress
              is already in the card above, so the list starts collapsed. */}
          <YStack gap="$3" pt="$4">
            <SizableText size="$headingMd">
              {intl.formatMessage({
                id: ETranslations.referral_all_levels__title,
              })}
            </SizableText>
            <LevelListSection
              currentLevel={data.currentLevel}
              levels={data.levels}
            />
          </YStack>
        </YStack>
      </ReferFriendsPageContainer>
    </ScrollView>
  );
}

// Mirrors the loaded layout: status card with two targets, then the level list.
function ReferralLevelSkeleton() {
  const cardStyle = useInviteListCardStyle();
  const { md } = useMedia();
  // The breadcrumb only shows on wide layouts.
  const showBreadcrumb = !platformEnv.isNative && !md;
  return (
    <ScrollView>
      <ReferFriendsPageContainer>
        <YStack py="$5" px="$pagePadding" gap="$4">
          {showBreadcrumb ? <Skeleton.BodyMd w={160} /> : null}
          <YStack
            gap="$5"
            p="$5"
            $md={{ p: '$4', pb: '$6', gap: '$4' }}
            {...cardStyle}
          >
            <XStack ai="center" gap="$4">
              <Skeleton w="$12" h="$12" radius="round" />
              <YStack gap="$1">
                <Skeleton.BodyMd />
                <Skeleton.HeadingXl />
                <Skeleton.BodySm w={120} />
              </YStack>
            </XStack>
            <Divider borderColor={INVITE_CARD_BORDER_COLOR} />
            <Skeleton.BodyMd w={200} />
            <XStack gap="$10" $md={{ flexDirection: 'column', gap: '$4' }}>
              {[0, 1].map((index) => (
                <YStack key={index} flex={1} gap="$2">
                  <Skeleton.BodyMd w={120} />
                  {md ? null : <Skeleton.Heading2Xl w={160} />}
                  <Skeleton w="100%" h="$1" radius="round" />
                </YStack>
              ))}
            </XStack>
          </YStack>
          <YStack gap="$3" pt="$4">
            <Skeleton.HeadingMd />
            <YStack overflow="hidden" {...cardStyle}>
              {[0, 1, 2, 3, 4].map((index) => (
                <XStack
                  key={index}
                  ai="center"
                  gap="$3"
                  py="$3.5"
                  px="$5"
                  $md={{ px: 0, mx: '$4' }}
                  borderTopWidth={index === 0 ? 0 : 1}
                  borderColor={INVITE_CARD_BORDER_COLOR}
                >
                  <Skeleton w="$6" h="$6" radius="round" />
                  <Skeleton.BodyLg />
                </XStack>
              ))}
            </YStack>
          </YStack>
        </YStack>
      </ReferFriendsPageContainer>
    </ScrollView>
  );
}

function ReferralLevelPage() {
  const intl = useIntl();
  const { md } = useMedia();
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const {
    result: levelDetail,
    isLoading,
    run: fetchLevelDetail,
  } = usePromiseResult(
    () => backgroundApiProxy.serviceReferralCode.getLevelDetail(),
    [],
    {
      watchLoading: true,
      // A failed request ends in the retry state instead of an endless spinner.
      undefinedResultIfError: true,
    },
  );

  let body: ReactNode;
  if (levelDetail) {
    body = <ReferralLevelContent data={levelDetail} />;
  } else if (isLoading !== false) {
    // `isLoading` is undefined until the first request starts.
    body = <ReferralLevelSkeleton />;
  } else {
    body = (
      <ReferFriendsLoadError
        testID={ReferFriendsTestIDs.levelRetryBtn}
        onRetry={() => {
          void fetchLevelDetail();
        }}
      />
    );
  }

  return (
    <Page>
      {platformEnv.isNative || md ? (
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.referral_referral_level,
          })}
        />
      ) : (
        <TabPageHeader
          sceneName={EAccountSelectorSceneName.home}
          tabRoute={ETabRoutes.ReferFriends}
          hideHeaderLeft={platformEnv.isDesktop}
        />
      )}
      <Page.Body>{body}</Page.Body>
    </Page>
  );
}

export default function ReferralLevel() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <ReferralLevelPage />
    </AccountSelectorProviderMirror>
  );
}
