import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Button,
  Icon,
  IconButton,
  useMedia,
} from '@onekeyhq/components';
import type { IActionListItemProps } from '@onekeyhq/components';
import { useInviteCodeList } from '@onekeyhq/kit/src/views/ReferFriends/pages/InviteReward/components/InvitationDetailsSection/hooks/useInviteCodeList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { EExportTimeRange } from '@onekeyhq/shared/src/referralCode/type';

export interface IFilterState {
  timeRange: EExportTimeRange;
  inviteCode?: string;
  startTime?: number;
  endTime?: number;
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

  const handleInviteCodeSelect = useCallback(
    (value?: string) => {
      onFilterChange({ inviteCode: value });
    },
    [onFilterChange],
  );

  const sections = useMemo(
    () => [
      {
        title: intl.formatMessage({
          id: ETranslations.referral_code_list,
        }),
        items: inviteCodeOptions.map((option) => ({
          label: option.label,
          description: option.description,
          descriptionNumberOfLines: 1,
          extra:
            filterState.inviteCode === option.value ? (
              <Icon name="CheckRadioSolid" size="$5" color="$icon" />
            ) : undefined,
          onPress: () => handleInviteCodeSelect(option.value),
        })) as IActionListItemProps[],
      },
    ],
    [intl, inviteCodeOptions, filterState, handleInviteCodeSelect],
  );

  // Check if any filters are active (not default values)
  const hasActiveFilters = useMemo(
    () => filterState.inviteCode !== undefined,
    [filterState.inviteCode],
  );

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

  // Desktop: Use component-style ActionList with Button trigger
  if (gtMd) {
    return (
      <ActionList
        title={intl.formatMessage({ id: ETranslations.referral_filter })}
        renderTrigger={
          <Button
            size="small"
            icon={hasActiveFilters ? 'Filter1Solid' : 'Filter1Outline'}
          >
            {intl.formatMessage({ id: ETranslations.referral_filter })}
          </Button>
        }
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
