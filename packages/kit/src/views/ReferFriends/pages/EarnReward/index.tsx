import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, DatePicker, Page, XStack, YStack } from '@onekeyhq/components';
import type { IDateRange } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useSpotlight } from '@onekeyhq/kit/src/components/Spotlight';
import { useRedirectWhenNotLoggedIn } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EExportSubject,
  EExportTab,
  EExportTimeRange,
} from '@onekeyhq/shared/src/referralCode/type';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  ExportButton,
  FilterButton,
  ReferFriendsDetailHeader,
  ReferFriendsPageContainer,
} from '../../components';
import { useDatePresets } from '../../hooks/useDatePresets';
import { useRewardFilter } from '../../hooks/useRewardFilter';

import { EarnRewardsTab } from './components';

function EarnRewardPageWrapper() {
  // Redirect to ReferAFriend page if user is not logged in
  useRedirectWhenNotLoggedIn();

  const intl = useIntl();
  const title = intl.formatMessage({
    id: ETranslations.referral_referred_type_2,
  });

  const { tourTimes, tourVisited } = useSpotlight(
    ESpotlightTour.earnRewardAlert,
  );

  const {
    filterState,
    updateFilter,
    setCustomDateRange,
    clearCustomDateRange,
    datePickerValue,
  } = useRewardFilter({
    startTime: new Date('2024-01-01T00:00:00.000').getTime(),
    endTime: (() => {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    })(),
  });

  // DatePicker intermediate state
  const [intermediateDateRange, setIntermediateDateRange] =
    useState<IDateRange | null>(null);

  const handleDateRangeChange = useCallback(
    (range: IDateRange) => {
      if (range.start && range.end) {
        const start = new Date(range.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(range.end);
        end.setHours(23, 59, 59, 999);
        setCustomDateRange(start.getTime(), end.getTime());
        setIntermediateDateRange(null);
      } else if (range.start) {
        setIntermediateDateRange(range);
      } else {
        setIntermediateDateRange(null);
        clearCustomDateRange();
      }
    },
    [setCustomDateRange, clearCustomDateRange],
  );

  const currentDatePickerValue = intermediateDateRange ?? datePickerValue;
  const maxDate = useMemo(() => new Date(), []);

  // Clear intermediate state when switching to preset time range
  useEffect(() => {
    if (filterState.timeRange !== EExportTimeRange.Custom) {
      setIntermediateDateRange(null);
    }
  }, [filterState.timeRange]);

  const presets = useDatePresets();

  const effectiveTimeRange =
    filterState.startTime && filterState.endTime
      ? undefined
      : filterState.timeRange;

  const toolbar = useMemo(
    () => (
      <>
        <YStack width={240}>
          <DatePicker.Range
            value={currentDatePickerValue}
            onChange={handleDateRangeChange}
            maxDate={maxDate}
            showPreviousMonth
            presets={presets}
          />
        </YStack>
        <XStack gap="$3">
          <FilterButton
            filterState={filterState}
            onFilterChange={updateFilter}
          />
          <ExportButton
            subject={EExportSubject.Onchain}
            timeRange={effectiveTimeRange}
            inviteCode={filterState.inviteCode}
            tab={EExportTab.Earn}
            startTime={filterState.startTime}
            endTime={filterState.endTime}
          />
        </XStack>
      </>
    ),
    [
      currentDatePickerValue,
      handleDateRangeChange,
      maxDate,
      presets,
      filterState,
      updateFilter,
      effectiveTimeRange,
    ],
  );

  return (
    <Page>
      <ReferFriendsDetailHeader title={title} toolbar={toolbar} />
      <Page.Body>
        <ReferFriendsPageContainer flex={1}>
          {tourTimes === 0 ? (
            <Alert
              closable
              description={intl.formatMessage({
                id: ETranslations.referral_earn_reward_tips,
              })}
              type="info"
              mx="$5"
              mb="$2.5"
              onClose={tourVisited}
            />
          ) : null}

          <EarnRewardsTab filterState={filterState} />
        </ReferFriendsPageContainer>
      </Page.Body>
    </Page>
  );
}

export default function EarnReward() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnRewardPageWrapper />
    </AccountSelectorProviderMirror>
  );
}
