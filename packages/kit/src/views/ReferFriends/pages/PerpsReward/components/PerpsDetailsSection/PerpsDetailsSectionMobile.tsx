import { useIntl } from 'react-intl';

import {
  SizableText,
  Spinner,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsEmptyData } from '../PerpsEmptyData';
import { PerpsRecordCard } from '../PerpsRecordCard';

import { TabButton } from './TabButton';
import { TabLoadingOverlay } from './TabLoadingOverlay';

import type { IPerpsDetailsSectionProps } from '.';

export function PerpsDetailsSectionMobile({
  records,
  activeTab,
  onTabChange,
  undistributedCount,
  totalCount,
  hideZeroVolume,
  onHideZeroVolumeChange,
  isLoadingMore,
  isTabLoading,
}: IPerpsDetailsSectionProps) {
  const intl = useIntl();

  const hasData = records.length > 0;

  return (
    <YStack px="$5" gap="$4">
      {/* Header - Title and Tab Switcher */}
      <XStack jc="space-between" ai="center">
        <SizableText size="$headingMd">
          {intl.formatMessage({
            id: ETranslations.global_details,
          })}
        </SizableText>

        {/* Tab Switcher */}
        <XStack bg="$neutral5" p="$0.5" borderRadius="$2.5" gap="$0.5">
          <TabButton
            label={intl.formatMessage({
              id: ETranslations.referral_undistributed,
            })}
            count={undistributedCount}
            isActive={activeTab === 'undistributed'}
            onPress={() => onTabChange('undistributed')}
          />
          <TabButton
            label={intl.formatMessage({
              id: ETranslations.referral_perps_total,
            })}
            count={totalCount}
            isActive={activeTab === 'total'}
            onPress={() => onTabChange('total')}
          />
        </XStack>
      </XStack>

      {/* Hide inactive toggle - only show for total tab */}
      {activeTab === 'total' ? (
        <XStack
          bg="$bgStrong"
          px="$2"
          py="$1"
          borderRadius="$2"
          jc="space-between"
          ai="center"
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.referral_perps_hide_inactive,
            })}
          </SizableText>
          <Switch
            size="small"
            value={hideZeroVolume}
            onChange={onHideZeroVolumeChange}
          />
        </XStack>
      ) : null}

      {/* Card List */}
      <YStack position="relative" minHeight={200}>
        <TabLoadingOverlay visible={!!isTabLoading} />
        {!isTabLoading && !hasData ? (
          <YStack py="$8">
            <PerpsEmptyData />
          </YStack>
        ) : (
          <YStack gap="$4">
            {records.map((record) => (
              <PerpsRecordCard key={record._id} item={record} />
            ))}
            {isLoadingMore ? (
              <YStack ai="center" py="$4">
                <Spinner size="small" />
              </YStack>
            ) : null}
          </YStack>
        )}
      </YStack>
    </YStack>
  );
}
