import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Empty,
  Page,
  RefreshControl,
  ScrollView,
  Spinner,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { TabPageHeader } from '@onekeyhq/kit/src/components/TabPageHeader';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IHardwareCumulativeRewards,
  IHardwareRecordItem,
} from '@onekeyhq/shared/src/referralCode/type';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { BreadcrumbSection, ReferFriendsPageContainer } from '../../components';

import { HardwareRecordCard } from './components/HardwareRecordCard';
import { HardwareRecordTable } from './components/HardwareRecordTable';
import { HardwareSalesRewardHeader } from './components/HardwareSalesRewardHeader';

function HardwareRecordsList({
  isLoading,
  records,
  isMobile,
}: {
  isLoading: boolean;
  records: IHardwareRecordItem[];
  isMobile: boolean;
}) {
  const intl = useIntl();

  if (isLoading && records.length === 0) {
    return (
      <YStack ai="center" jc="center" py="$10" px="$5">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (records.length === 0) {
    return (
      <YStack px="$5" gap="$3" pb="$5">
        <Empty
          icon="GiftOutline"
          title={intl.formatMessage({
            id: ETranslations.referral_referred_empty,
          })}
          description={intl.formatMessage({
            id: ETranslations.referral_referred_empty_desc,
          })}
        />
      </YStack>
    );
  }

  if (isMobile) {
    return (
      <YStack px="$5" gap="$3" pb="$5">
        {records.map((record) => (
          <HardwareRecordCard key={record._id} item={record} />
        ))}
      </YStack>
    );
  }

  return (
    <YStack px="$5" gap="$3" pb="$5">
      <HardwareRecordTable records={records} />
    </YStack>
  );
}

function HardwareSalesRewardPageWrapper() {
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.hardwareSalesRewardAlert,
  );
  const intl = useIntl();
  const { md } = useMedia();

  const [isLoading, setIsLoading] = useState(false);
  const [cumulativeRewards, setCumulativeRewards] = useState<
    IHardwareCumulativeRewards | undefined
  >();

  // Hardware Records state
  const [hardwareRecords, setHardwareRecords] = useState<IHardwareRecordItem[]>(
    [],
  );

  const onRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cumulativeRewardsResult, recordsResult] = await Promise.allSettled(
        [
          backgroundApiProxy.serviceReferralCode.getHardwareCumulativeRewards(),
          backgroundApiProxy.serviceReferralCode.getHardwareRecords(),
        ],
      );

      if (cumulativeRewardsResult.status === 'fulfilled') {
        setCumulativeRewards(cumulativeRewardsResult.value);
      }

      if (recordsResult.status === 'fulfilled') {
        setHardwareRecords(recordsResult.value.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void onRefresh();
  }, [onRefresh]);

  return (
    <Page>
      {platformEnv.isNative || md ? (
        <Page.Header
          title={intl.formatMessage({
            id: ETranslations.referral_referred_type_3,
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
        <ReferFriendsPageContainer flex={1} position="relative">
          {cumulativeRewards === undefined ? (
            <YStack
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              ai="center"
              jc="center"
              flex={1}
            >
              <Spinner size="large" />
            </YStack>
          ) : (
            <ScrollView
              flex={1}
              refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
              }
              contentContainerStyle={{ pb: '$5' }}
            >
              {/* Breadcrumb for desktop */}
              {!platformEnv.isNative && !md ? (
                <XStack px="$5" py="$5">
                  <BreadcrumbSection
                    secondItemLabel={intl.formatMessage({
                      id: ETranslations.referral_referred_type_3,
                    })}
                  />
                </XStack>
              ) : null}

              {/* Alert tip */}
              {tourTimes === 0 ? (
                <Alert
                  closable
                  description={intl.formatMessage({
                    id: ETranslations.referral_sales_reward_tips,
                  })}
                  type="info"
                  mx="$5"
                  mb="$2.5"
                  onClose={tourVisited}
                />
              ) : null}

              {/* Hardware Sales Reward Header */}
              <HardwareSalesRewardHeader
                cumulativeRewards={cumulativeRewards}
                isLoading={isLoading}
                onRefresh={onRefresh}
              />

              {/* Hardware Records List */}
              <HardwareRecordsList
                isLoading={isLoading}
                records={hardwareRecords}
                isMobile={md}
              />
            </ScrollView>
          )}
        </ReferFriendsPageContainer>
      </Page.Body>
    </Page>
  );
}

export default function HardwareSalesReward() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HardwareSalesRewardPageWrapper />
    </AccountSelectorProviderMirror>
  );
}
