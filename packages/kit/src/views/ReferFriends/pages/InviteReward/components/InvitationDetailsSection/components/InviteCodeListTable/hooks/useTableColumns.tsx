import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteCodeListItem } from '@onekeyhq/shared/src/referralCode/type';

import { CodeCell } from '../components/CodeCell';
import { CopyLinkButton } from '../components/CopyLinkButton';
import { NoteCell } from '../components/NoteCell';
import { EInviteCodeListTableColumn, SORTABLE_COLUMNS } from '../const';

import type { ISortableColumn } from './useSortableData';

export function useTableColumns(
  onSortChange: (
    column: ISortableColumn,
    order: 'asc' | 'desc' | undefined,
  ) => void,
  onNoteUpdated?: () => void,
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
        dataIndex: EInviteCodeListTableColumn.CODE,
        columnWidth: 150,
        render: (text: string) => <CodeCell code={text} />,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_code_list_note,
        }),
        dataIndex: EInviteCodeListTableColumn.NOTE,
        columnWidth: 150,
        render: (_text: string, record: IInviteCodeListItem) => (
          <NoteCell
            code={record.code}
            note={record.note}
            onNoteUpdated={onNoteUpdated}
          />
        ),
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_code_list_sales,
        }),
        dataIndex: EInviteCodeListTableColumn.SALES_ORDERS,
        align: 'left',
        columnWidth: 150,
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
        dataIndex: EInviteCodeListTableColumn.ONCHAIN_WALLETS,
        columnWidth: 150,
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
        dataIndex: EInviteCodeListTableColumn.CUMULATIVE_REWARDS,
        columnWidth: 150,
        align: 'left',
        render: (value: string) => (
          <SizableText size="$bodyMdMedium" color="$text">
            ${value}
          </SizableText>
        ),
      },
      {
        title: intl.formatMessage({ id: ETranslations.referral_code_list_at }),
        dataIndex: EInviteCodeListTableColumn.CREATED_AT,
        columnWidth: 150,
        render: (date: string) => (
          <SizableText size="$bodyMdMedium" color="$text">
            {formatDate(date)}
          </SizableText>
        ),
      },
      {
        title: '',
        dataIndex: EInviteCodeListTableColumn.INVITE_URL,
        render: (url: string) => <CopyLinkButton url={url} />,
      },
    ],
    [intl, formatDate, onNoteUpdated],
  );

  // Handle header row for sorting
  const handleHeaderRow = useCallback(
    (column: ITableColumn<IInviteCodeListItem>) => {
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
