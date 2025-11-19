import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, useMedia } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  const { gtLg } = useMedia();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const currencySymbol = currencyInfo?.symbol ?? '';

  // Define columns
  const columns: ITableColumn<IInviteCodeListItem>[] = useMemo(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.referral_your_code }),
        dataIndex: EInviteCodeListTableColumn.CODE,
        columnWidth: 130,
        render: (text: string) => <CodeCell code={text} />,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_code_list_note,
        }),
        dataIndex: EInviteCodeListTableColumn.NOTE,
        ...(gtLg
          ? { columnProps: { flex: 1 } }
          : {
              columnWidth: Math.max(
                intl.formatMessage({
                  id: ETranslations.referral_code_list_note,
                }).length * 10,
                160,
              ),
            }),
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
        ...(gtLg
          ? { columnProps: { flex: 1 } }
          : {
              columnWidth: Math.max(
                intl.formatMessage({
                  id: ETranslations.referral_code_list_sales,
                }).length * 10,
                100,
              ),
            }),
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
        ...(gtLg
          ? { columnProps: { flex: 1 } }
          : {
              columnWidth: Math.max(
                intl.formatMessage({
                  id: ETranslations.referral_code_list_wallets,
                }).length * 10,
                130,
              ),
            }),
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
        ...(gtLg
          ? { columnProps: { flex: 1 } }
          : {
              columnWidth: Math.max(
                intl.formatMessage({
                  id: ETranslations.referral_cumulative_rewards,
                }).length * 8,
                130,
              ),
            }),
        align: 'left',
        render: (value: string) => (
          <SizableText size="$bodyMdMedium" color="$text">
            {currencySymbol ? `${currencySymbol}${value}` : value}
          </SizableText>
        ),
      },
      {
        title: intl.formatMessage({ id: ETranslations.referral_code_list_at }),
        dataIndex: EInviteCodeListTableColumn.CREATED_AT,
        ...(gtLg ? { columnProps: { flex: 1 } } : { columnWidth: 145 }),
        render: (date: string) => (
          <SizableText size="$bodyMdMedium" color="$text">
            {formatDate(date, { hideSeconds: true })}
          </SizableText>
        ),
      },
      {
        title: '',
        dataIndex: EInviteCodeListTableColumn.INVITE_URL,
        columnWidth: Math.max(
          intl.formatMessage({ id: ETranslations.browser_copy_link }).length *
            10,
          100,
        ),
        render: (url: string) => <CopyLinkButton url={url} />,
      },
    ],
    [currencySymbol, intl, gtLg, onNoteUpdated],
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
