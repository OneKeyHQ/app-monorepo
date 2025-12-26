import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IInviteCodeListItem } from '@onekeyhq/shared/src/referralCode/type';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { CodeCell } from '../components/CodeCell';
import { CopyLinkSplitButton } from '../components/CopyLinkSplitButton';
import { NoteCell } from '../components/NoteCell';
import { EInviteCodeListTableColumn, SORTABLE_COLUMNS } from '../const';

import type { ISortableColumn } from './useSortableData';

export function useTableColumns(
  containerWidth: number,
  onSortChange: (
    column: ISortableColumn,
    order: 'asc' | 'desc' | undefined,
  ) => void,
  onNoteUpdated?: () => void,
) {
  const intl = useIntl();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const currencySymbol = currencyInfo?.symbol ?? '';

  // Calculate column widths
  const columnWidths = useMemo(() => {
    const noteWidth = Math.max(
      intl.formatMessage({ id: ETranslations.referral_code_list_note }).length *
        10,
      160,
    );
    const salesWidth = Math.max(
      intl.formatMessage({ id: ETranslations.referral_code_list_sales })
        .length * 10,
      100,
    );
    const walletsWidth = Math.max(
      intl.formatMessage({ id: ETranslations.referral_code_list_wallets })
        .length * 10,
      130,
    );
    const rewardsWidth = Math.max(
      intl.formatMessage({ id: ETranslations.referral_cumulative_rewards })
        .length * 9,
      135,
    );
    const createdAtWidth = 145;
    const codeWidth = 130;
    const inviteUrlWidth = Math.max(
      intl.formatMessage({ id: ETranslations.browser_copy_link }).length * 10 +
        40,
      135,
    );

    return {
      noteWidth,
      salesWidth,
      walletsWidth,
      rewardsWidth,
      createdAtWidth,
      codeWidth,
      inviteUrlWidth,
    };
  }, [intl]);

  // Calculate total fixed width
  const totalFixedWidth = useMemo(() => {
    return (
      columnWidths.codeWidth +
      columnWidths.noteWidth +
      columnWidths.salesWidth +
      columnWidths.walletsWidth +
      columnWidths.rewardsWidth +
      columnWidths.createdAtWidth +
      columnWidths.inviteUrlWidth
    );
  }, [columnWidths]);

  // Determine if we should use flex layout
  const shouldUseFlex = useMemo(() => {
    return containerWidth > 0 && containerWidth >= totalFixedWidth;
  }, [containerWidth, totalFixedWidth]);

  // Define columns
  const columns: ITableColumn<IInviteCodeListItem>[] = useMemo(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.referral_your_code }),
        dataIndex: EInviteCodeListTableColumn.CODE,
        columnWidth: columnWidths.codeWidth,
        render: (text: string) => <CodeCell code={text} />,
      },
      {
        title: intl.formatMessage({
          id: ETranslations.referral_code_list_note,
        }),
        dataIndex: EInviteCodeListTableColumn.NOTE,
        ...(shouldUseFlex
          ? { columnProps: { flex: 1 } }
          : { columnWidth: columnWidths.noteWidth }),
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
        ...(shouldUseFlex
          ? { columnProps: { flex: 1 } }
          : { columnWidth: columnWidths.salesWidth }),
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
        ...(shouldUseFlex
          ? { columnProps: { flex: 1 } }
          : { columnWidth: columnWidths.walletsWidth }),
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
        ...(shouldUseFlex
          ? { columnProps: { flex: 1 } }
          : { columnWidth: columnWidths.rewardsWidth }),
        align: 'left',
        render: (value: string) => {
          const formattedValue = new BigNumber(value).toFixed(2);
          return (
            <SizableText size="$bodyMdMedium" color="$text">
              {currencySymbol
                ? `${currencySymbol}${formattedValue}`
                : formattedValue}
            </SizableText>
          );
        },
      },
      {
        title: intl.formatMessage({ id: ETranslations.referral_code_list_at }),
        dataIndex: EInviteCodeListTableColumn.CREATED_AT,
        ...(shouldUseFlex
          ? { columnProps: { flex: 1 } }
          : { columnWidth: columnWidths.createdAtWidth }),
        render: (date: string) => (
          <SizableText size="$bodyMdMedium" color="$text">
            {formatDate(date, { hideSeconds: true })}
          </SizableText>
        ),
      },
      {
        title: '',
        align: 'right',
        dataIndex: EInviteCodeListTableColumn.INVITE_URL,
        columnWidth: columnWidths.inviteUrlWidth,
        render: (url: string) => <CopyLinkSplitButton url={url} />,
      },
    ],
    [
      intl,
      columnWidths.codeWidth,
      columnWidths.noteWidth,
      columnWidths.salesWidth,
      columnWidths.walletsWidth,
      columnWidths.rewardsWidth,
      columnWidths.createdAtWidth,
      columnWidths.inviteUrlWidth,
      shouldUseFlex,
      onNoteUpdated,
      currencySymbol,
    ],
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
    shouldUseFlex,
  };
}
