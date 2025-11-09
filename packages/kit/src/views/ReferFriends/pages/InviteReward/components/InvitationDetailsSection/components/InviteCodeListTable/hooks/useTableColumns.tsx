import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, useMedia } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteCodeListItem } from '@onekeyhq/shared/src/referralCode/type';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

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
  const { gtMd } = useMedia();

  // Define columns
  const columns: ITableColumn<IInviteCodeListItem>[] = useMemo(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.referral_your_code }),
        dataIndex: EInviteCodeListTableColumn.CODE,
        ...(gtMd ? { columnProps: { flex: 1 } } : { columnWidth: 130 }),
        render: (text: string) => <CodeCell code={text} />,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_code_list_note,
        }),
        dataIndex: EInviteCodeListTableColumn.NOTE,
        ...(gtMd ? { columnProps: { flex: 1 } } : { columnWidth: 130 }),
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
        ...(gtMd ? { columnProps: { flex: 1 } } : { columnWidth: 130 }),
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
        ...(gtMd ? { columnProps: { flex: 1 } } : { columnWidth: 130 }),
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
        ...(gtMd ? { columnProps: { flex: 1 } } : { columnWidth: 130 }),
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
        ...(gtMd ? { columnProps: { flex: 1 } } : { columnWidth: 130 }),
        render: (date: string) => (
          <SizableText size="$bodyMdMedium" color="$text">
            {formatDate(date, { hideTimeForever: true })}
          </SizableText>
        ),
      },
      {
        title: '',
        dataIndex: EInviteCodeListTableColumn.INVITE_URL,
        columnWidth: 100,
        render: (url: string) => <CopyLinkButton url={url} />,
      },
    ],
    [intl, gtMd, onNoteUpdated],
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
