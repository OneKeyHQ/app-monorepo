import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Icon, IconButton, useMedia } from '@onekeyhq/components';
import type { IActionListItemProps } from '@onekeyhq/components';
import { useInviteCodeList } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InvitationDetailsSection/hooks/useInviteCodeList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EExportTimeRange } from '@onekeyhq/shared/src/referralCode/type';

export interface IFilterState {
  timeRange: EExportTimeRange;
  inviteCode?: string;
}

interface IFilterButtonProps {
  filterState: IFilterState;
  onFilterChange: (updates: Partial<IFilterState>) => void;
}

export function FilterButton({
  filterState,
  onFilterChange,
}: IFilterButtonProps) {
  const intl = useIntl();
  const { codeListData } = useInviteCodeList();
  const { gtMd } = useMedia();

  const timeRangeOptions = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.referral_filter_alltime,
        }),
        value: EExportTimeRange.All,
      },
      {
        label: intl.formatMessage({ id: ETranslations.referral_filter_30 }),
        value: EExportTimeRange.OneMonth,
      },
      {
        label: intl.formatMessage({ id: ETranslations.referral_filter_90 }),
        value: EExportTimeRange.ThreeMonths,
      },
    ],
    [intl],
  );

  const inviteCodeOptions = useMemo(() => {
    const options: Array<{
      label: string;
      value?: string;
      description?: string;
    }> = [
      {
        label: intl.formatMessage({
          id: ETranslations.referral_filter_code_all,
        }),
        value: undefined,
      },
    ];

    if (codeListData?.items) {
      codeListData.items.forEach((item) => {
        const note = item.note?.trim();
        options.push({
          label: item.code,
          value: item.code,
          description: note || undefined,
        });
      });
    }

    return options;
  }, [intl, codeListData]);

  const handleTimeRangeSelect = useCallback(
    (value: EExportTimeRange) => {
      onFilterChange({ timeRange: value });
    },
    [onFilterChange],
  );

  const handleInviteCodeSelect = useCallback(
    (value?: string) => {
      onFilterChange({ inviteCode: value });
    },
    [onFilterChange],
  );

  const sections = useMemo(() => {
    return [
      {
        title: intl.formatMessage({ id: ETranslations.referral_filter_time }),
        items: timeRangeOptions.map((option) => ({
          label: option.label,
          extra:
            filterState.timeRange === option.value ? (
              <Icon name="CheckRadioSolid" size="$5" color="$icon" />
            ) : undefined,
          onPress: () => handleTimeRangeSelect(option.value),
        })) as IActionListItemProps[],
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_code_list,
        }),
        items: inviteCodeOptions.map((option) => ({
          label: option.label,
          description: option.description,
          extra:
            filterState.inviteCode === option.value ? (
              <Icon name="CheckRadioSolid" size="$5" color="$icon" />
            ) : undefined,
          onPress: () => handleInviteCodeSelect(option.value),
        })) as IActionListItemProps[],
      },
    ];
  }, [
    intl,
    timeRangeOptions,
    inviteCodeOptions,
    filterState,
    handleTimeRangeSelect,
    handleInviteCodeSelect,
  ]);

  // Check if any filters are active (not default values)
  const hasActiveFilters = useMemo(() => {
    return (
      filterState.timeRange !== EExportTimeRange.All ||
      filterState.inviteCode !== undefined
    );
  }, [filterState]);

  // Handle mobile click to show ActionList
  const handleMobileClick = useCallback(() => {
    ActionList.show({
      title: intl.formatMessage({ id: ETranslations.referral_filter }),
      sections,
      sheetProps: {
        snapPointsMode: 'percent',
        snapPoints: [70],
      },
    });
  }, [intl, sections]);

  // Render trigger (shared between desktop and mobile)
  const renderTrigger = useMemo(
    () => (
      <IconButton
        icon={hasActiveFilters ? 'Filter1Solid' : 'Filter1Outline'}
        variant="tertiary"
        title={intl.formatMessage({ id: ETranslations.referral_filter })}
      />
    ),
    [hasActiveFilters, intl],
  );

  // Desktop: Use component-style ActionList (works correctly)
  if (gtMd) {
    return (
      <ActionList
        title={intl.formatMessage({ id: ETranslations.referral_filter })}
        renderTrigger={renderTrigger}
        sections={sections}
        floatingPanelProps={{
          width: '$56',
          maxHeight: '$96',
        }}
      />
    );
  }

  // Mobile: Use ActionList.show() to avoid Portal nesting issues
  return (
    <IconButton
      icon={hasActiveFilters ? 'Filter1Solid' : 'Filter1Outline'}
      variant="tertiary"
      title={intl.formatMessage({ id: ETranslations.referral_filter })}
      onPress={handleMobileClick}
    />
  );
}
