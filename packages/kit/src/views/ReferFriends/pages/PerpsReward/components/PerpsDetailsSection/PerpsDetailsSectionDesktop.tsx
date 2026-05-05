import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { SizableText, Switch, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsEmptyData } from '../PerpsEmptyData';
import { PerpsRecordTable } from '../PerpsRecordTable';

import { TabButton } from './TabButton';
import { TabLoadingOverlay } from './TabLoadingOverlay';

import type { IPerpsDetailsSectionProps } from '.';

export function PerpsDetailsSectionDesktop({
  records,
  activeTab,
  onTabChange,
  undistributedCount,
  totalCount,
  hideZeroVolume,
  onHideZeroVolumeChange,
  sortBy,
  sortOrder,
  onSort,
  isLoadingMore,
  isTabLoading,
  hasUserSorted,
}: IPerpsDetailsSectionProps) {
  const intl = useIntl();

  const hasData = records.length > 0;

  return (
    <YStack px="$5" gap="$4">
      <YStack
        bg="$bgSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        overflow="hidden"
      >
        <XStack
          px="$5"
          py="$3"
          jc="space-between"
          ai="center"
          borderBottomWidth={StyleSheet.hairlineWidth}
          borderBottomColor="$borderSubdued"
        >
          <SizableText size="$headingMd">
            {intl.formatMessage({
              id: ETranslations.global_details,
            })}
          </SizableText>

          <XStack gap="$3" ai="center">
            {/* Hide inactive toggle - only show for total tab */}
            {activeTab === 'total' ? (
              <XStack gap="$2.5" ai="center">
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
        </XStack>

        {/* Table Content */}
        <YStack bg="$bgApp" position="relative" minHeight={200}>
          <TabLoadingOverlay visible={!!isTabLoading} />
          {!isTabLoading && !hasData ? (
            <YStack py="$8">
              <PerpsEmptyData />
            </YStack>
          ) : (
            <PerpsRecordTable
              records={records}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={onSort}
              isLoadingMore={isLoadingMore}
              hasUserSorted={hasUserSorted}
            />
          )}
        </YStack>
      </YStack>
    </YStack>
  );
}
