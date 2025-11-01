import { useIntl } from 'react-intl';

import { Page, ScrollView, Spinner, Stack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { BreadcrumbSection } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/components/BreadcrumbSection';
import { CurrentLevelSection } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/components/CurrentLevelSection';
import { LevelListSection } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferralLevel/components/LevelListSection';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

function ReferralLevelContent({ data }: { data: IInviteLevelDetail }) {
  // Find current level info
  const currentLevelInfo = data.levels.find((level) => level.isCurrent);

  return (
    <ScrollView>
      <YStack px="$5" py="$5" gap="$5">
        <BreadcrumbSection />
        {currentLevelInfo ? (
          <CurrentLevelSection
            currentLevel={data.currentLevel}
            levelEmoji={currentLevelInfo.emoji}
            levelLabel={currentLevelInfo.label}
          />
        ) : null}
        <LevelListSection levels={data.levels} />
      </YStack>
    </ScrollView>
  );
}

function ReferralLevelPage() {
  const intl = useIntl();

  const { result: levelDetail, isLoading } = usePromiseResult(
    () => backgroundApiProxy.serviceReferralCode.getLevelDetail(),
    [],
    {
      watchLoading: true,
    },
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.referral_referral_level,
        })}
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

export default ReferralLevelPage;
