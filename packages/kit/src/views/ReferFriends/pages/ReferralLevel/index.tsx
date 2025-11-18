import { useIntl } from 'react-intl';

import {
  Page,
  ScrollView,
  Spinner,
  Stack,
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

import { BreadcrumbSection, ReferFriendsPageContainer } from '../../components';

import { CurrentLevelSection } from './components/CurrentLevelSection';
import { LevelListSection } from './components/LevelListSection';
import { UpgradeProgressTitle } from './components/UpgradeProgressTitle';

function ReferralLevelContent({ data }: { data: IInviteLevelDetail }) {
  const intl = useIntl();

  // Find current level info
  const currentLevelInfo = data.levels.find((level) => level.isCurrent);

  return (
    <ScrollView>
      <ReferFriendsPageContainer py="$5" gap="$5">
        <BreadcrumbSection
          secondItemLabel={intl.formatMessage({
            id: ETranslations.referral_referral_level,
          })}
        />
        {currentLevelInfo ? (
          <CurrentLevelSection
            currentLevel={data.currentLevel}
            levelIcon={currentLevelInfo.icon}
            levelLabel={currentLevelInfo.label}
          />
        ) : null}
        <UpgradeProgressTitle />

        <LevelListSection levels={data.levels} />
      </ReferFriendsPageContainer>
    </ScrollView>
  );
}

function ReferralLevelPage() {
  const intl = useIntl();
  const { md } = useMedia();
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const { result: levelDetail, isLoading } = usePromiseResult(
    () => backgroundApiProxy.serviceReferralCode.getLevelDetail(),
    [],
    {
      watchLoading: true,
    },
  );

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
      <Page.Body>
        {isLoading || !levelDetail ? (
          <Stack flex={1} ai="center" jc="center">
            <Spinner size="large" />
          </Stack>
        ) : (
          <ReferralLevelContent data={levelDetail} />
        )}
      </Page.Body>
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
