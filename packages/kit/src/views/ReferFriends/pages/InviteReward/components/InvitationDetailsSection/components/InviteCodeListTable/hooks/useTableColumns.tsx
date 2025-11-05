import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteCodeListItem } from '@onekeyhq/shared/src/referralCode/type';

import { CodeCell } from '../components/CodeCell';
import { CopyLinkButton } from '../components/CopyLinkButton';
import { NoteCell } from '../components/NoteCell';

import type { ISortableColumn } from './useSortableData';

export function useTableColumns(
  onSortChange: (
    column: ISortableColumn,
    order: 'asc' | 'desc' | undefined,
  ) => void,
) {
  const intl = useIntl();

  // Format date
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }, []);

  // Define columns
  const columns: ITableColumn<IInviteCodeListItem>[] = useMemo(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.referral_your_code }),
        dataIndex: 'code',
        columnWidth: 192,
        render: (text: string) => <CodeCell code={text} />,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_code_list_note,
        }),
        dataIndex: 'note',
        columnWidth: 200,
        render: (text: string) => <NoteCell note={text} />,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_code_list_sales,
        }),
        dataIndex: 'salesOrders',
        align: 'left',
        columnWidth: 200,
        render: (value: number) => (
          <SizableText size="$bodyMdMedium" color="$text">
            {value}
          </SizableText>
        ),
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_code_list_wallets,
        }),
        dataIndex: 'onchainWallets',
        columnWidth: 200,
        render: (value: number) => (
          <SizableText size="$bodyMdMedium" color="$text">
            {value}
          </SizableText>
        ),
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_cumulative_rewards,
        }),
        dataIndex: 'cumulativeRewardsFiatValue',
        columnWidth: 200,
        align: 'right',
        render: (value: string) => (
          <SizableText size="$bodyMdMedium" color="$text">
            ${value}
          </SizableText>
        ),
      },
      {
        title: intl.formatMessage({ id: ETranslations.referral_code_list_at }),
        dataIndex: 'createdAt',
        columnWidth: 200,
        render: (date: string) => (
          <SizableText size="$bodyMdMedium" color="$text">
            {formatDate(date)}
          </SizableText>
        ),
      },
      {
        title: '',
        dataIndex: 'inviteUrl',
        render: (url: string) => <CopyLinkButton url={url} />,
      },
    ],
    [intl, formatDate],
  );

  // Handle header row for sorting
  const handleHeaderRow = useCallback(
    (column: ITableColumn<IInviteCodeListItem>) => {
      const SORTABLE_COLUMNS: ISortableColumn[] = [
        'salesOrders',
        'onchainWallets',
        'cumulativeRewardsFiatValue',
        'createdAt',
      ];

      if (SORTABLE_COLUMNS.includes(column.dataIndex as ISortableColumn)) {
        return {
          onSortTypeChange: (order: 'asc' | 'desc' | undefined) => {
            onSortChange(column.dataIndex as ISortableColumn, order);
          },
        };
      }

      return undefined;
    },
    [onSortChange],
  );

  return {
    columns,
    handleHeaderRow,
  };
}
