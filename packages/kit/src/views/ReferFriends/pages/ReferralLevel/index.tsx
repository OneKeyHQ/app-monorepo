import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Page, ScrollView, Spinner, Stack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteLevelDetail } from '@onekeyhq/shared/src/referralCode/type';

import { ApiDataButton } from './components/ApiDataButton';
import { BreadcrumbSection } from './components/BreadcrumbSection';
import { CurrentLevelSection } from './components/CurrentLevelSection';
import { LevelListSection } from './components/LevelListSection';

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
  const intl = useIntl();

  const { result: levelDetail, isLoading } = usePromiseResult(
    () => backgroundApiProxy.serviceReferralCode.getLevelDetail(),
    [],
    {
      watchLoading: true,
    },
  );

  const headerRight = useCallback(
    () => <ApiDataButton data={levelDetail} />,
    [levelDetail],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.referral_referral_level,
        })}
        headerRight={headerRight}
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
