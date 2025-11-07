import { useIntl } from 'react-intl';

import { Page, ScrollView, Spinner, Stack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { BreadcrumbSection } from '../../components';

import { ApiDataButton } from './components/ApiDataButton';
import { CurrentLevelSection } from './components/CurrentLevelSection';
import { LevelListSection } from './components/LevelListSection';
import { UpgradeProgressTitle } from './components/UpgradeProgressTitle';

function ReferralLevelContent({ data }: { data: IInviteLevelDetail }) {
  const intl = useIntl();

  // Find current level info
  const currentLevelInfo = data.levels.find((level) => level.isCurrent);

  return (
    <ScrollView>
      <YStack px="$5" py="$5" gap="$5">
        <BreadcrumbSection
          secondItemLabel={intl.formatMessage({
            id: ETranslations.referral_referral_level,
          })}
        />
        <UpgradeProgressTitle />
        {currentLevelInfo ? (
          <CurrentLevelSection
            currentLevel={data.currentLevel}
            levelIcon={currentLevelInfo.icon}
            levelLabel={currentLevelInfo.label}
          />
        ) : null}
        <LevelListSection levels={data.levels} />
      </YStack>
    </ScrollView>
  );
}

function ReferralLevelPage() {
  const { result: levelDetail, isLoading } = usePromiseResult(
    () => backgroundApiProxy.serviceReferralCode.getLevelDetail(),
    [],
    {
      watchLoading: true,
    },
  );

  return (
    <Page>
      <TabPageHeader
        sceneName={EAccountSelectorSceneName.home}
        tabRoute={ETabRoutes.ReferFriends}
        customHeaderRightItems={<ApiDataButton data={levelDetail} />}
      />
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
