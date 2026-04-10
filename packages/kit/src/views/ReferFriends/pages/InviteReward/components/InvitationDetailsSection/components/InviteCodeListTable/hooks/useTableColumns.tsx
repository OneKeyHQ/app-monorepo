import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import type { ITableColumn } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';

import { CodeCell } from '../components/CodeCell';
import { CopyLinkSplitButton } from '../components/CopyLinkSplitButton';
import {
  EInviteCodeListTableColumn,
  type IInviteCodeListTableItem,
  INVITE_CODE_COLUMN_CODE_CHAR_WIDTH,
  INVITE_CODE_COLUMN_EXTRA_WIDTH,
  INVITE_CODE_COLUMN_HEADER_CHAR_WIDTH,
  INVITE_CODE_COLUMN_MIN_CODE_LENGTH,
  INVITE_CODE_COLUMN_NOTE_WIDTH,
  SORTABLE_COLUMNS,
} from '../const';

import type { ISortableColumn } from './useSortableData';

export function useTableColumns(
  containerWidth: number,
  onSortChange: (
    column: ISortableColumn,
    order: 'asc' | 'desc' | undefined,
  ) => void,
  onCodeUpdated?: (shouldRefreshSummary?: boolean) => Promise<void> | void,
  codeItems?: IInviteCodeListTableItem[],
) {
  const intl = useIntl();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const currencySymbol = currencyInfo?.symbol ?? '';

  // Calculate column widths
  const columnWidths = useMemo(() => {
    const codeTitle = intl.formatMessage({
      id: ETranslations.referral_your_code,
    });
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

    const maxCodeLength =
      codeItems?.reduce(
        (max, item) => Math.max(max, (item.displayCode ?? item.code).length),
        0,
      ) ?? 0;
    // Keep the fixed code column aligned with the actual cell/header layout.
    const codeContentWidth = Math.max(
      INVITE_CODE_COLUMN_MIN_CODE_LENGTH * INVITE_CODE_COLUMN_CODE_CHAR_WIDTH +
        INVITE_CODE_COLUMN_EXTRA_WIDTH,
      maxCodeLength * INVITE_CODE_COLUMN_CODE_CHAR_WIDTH +
        INVITE_CODE_COLUMN_EXTRA_WIDTH,
    );
    const codeHeaderWidth =
      codeTitle.length * INVITE_CODE_COLUMN_HEADER_CHAR_WIDTH;
    const codeWidth = Math.max(
      INVITE_CODE_COLUMN_NOTE_WIDTH,
      codeHeaderWidth,
      codeContentWidth,
    );
    const inviteUrlWidth = Math.max(
      intl.formatMessage({ id: ETranslations.browser_copy_link }).length * 10 +
        40,
      135,
    );

    return {
      salesWidth,
      walletsWidth,
      rewardsWidth,
      createdAtWidth,
      codeWidth,
      inviteUrlWidth,
    };
  }, [intl, codeItems]);

  // Calculate total fixed width
  const totalFixedWidth = useMemo(() => {
    return (
      columnWidths.codeWidth +
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
  const columns: ITableColumn<IInviteCodeListTableItem>[] = useMemo(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.referral_your_code }),
        dataIndex: EInviteCodeListTableColumn.CODE,
        columnWidth: columnWidths.codeWidth,
        columnProps: { overflow: 'hidden' },
        render: (_text: string, record: IInviteCodeListTableItem) => (
          <CodeCell
            code={record.code}
            displayCode={record.displayCode}
            note={record.note}
            isPrimary={record.isPrimary}
            isCustomCode={record.isCustomCode}
            onUpdated={onCodeUpdated}
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
      columnWidths.salesWidth,
      columnWidths.walletsWidth,
      columnWidths.rewardsWidth,
      columnWidths.createdAtWidth,
      columnWidths.inviteUrlWidth,
      shouldUseFlex,
      onCodeUpdated,
      currencySymbol,
    ],
  );

  // Handle header row for sorting
  const handleHeaderRow = useCallback(
    (column: ITableColumn<IInviteCodeListTableItem>) => {
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

  // Split columns into fixed and scrollable
  const fixedColumns = useMemo(
    () => columns.filter((col) => col.dataIndex === 'code'),
    [columns],
  );

  const scrollableColumns = useMemo(
    () => columns.filter((col) => col.dataIndex !== 'code'),
    [columns],
  );

  return {
    columns,
    fixedColumns,
    scrollableColumns,
    handleHeaderRow,
    shouldUseFlex,
  };
}
