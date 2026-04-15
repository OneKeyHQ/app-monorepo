import type { IInviteCodeListItem } from '@onekeyhq/shared/src/referralCode/type';

/**
 * Column data index enum for InviteCodeListTable
 */
export enum EInviteCodeListTableColumn {
  CODE = 'code',
  SALES_ORDERS = 'salesOrders',
  ONCHAIN_WALLETS = 'onchainWallets',
  CUMULATIVE_REWARDS = 'cumulativeRewardsFiatValue',
  CREATED_AT = 'createdAt',
  INVITE_URL = 'inviteUrl',
}

/**
 * Sortable columns for InviteCodeListTable
 */
export const SORTABLE_COLUMNS = [
  EInviteCodeListTableColumn.SALES_ORDERS,
  EInviteCodeListTableColumn.ONCHAIN_WALLETS,
  EInviteCodeListTableColumn.CUMULATIVE_REWARDS,
  EInviteCodeListTableColumn.CREATED_AT,
] as const;

/**
 * Shared layout constants for the fixed code column.
 */
export const INVITE_CODE_COLUMN_NOTE_WIDTH = 150;
export const INVITE_CODE_COLUMN_CODE_CHAR_WIDTH = 9;
export const INVITE_CODE_COLUMN_HEADER_CHAR_WIDTH = 10;
export const INVITE_CODE_COLUMN_EXTRA_WIDTH = 70;
export const INVITE_CODE_COLUMN_MIN_CODE_LENGTH = 8;

export type IInviteCodeListTableItem = IInviteCodeListItem & {
  displayCode?: string;
};

/**
 * Type for sortable columns
 */
export type ISortableColumn =
  (typeof SORTABLE_COLUMNS)[number] extends EInviteCodeListTableColumn
    ? (typeof SORTABLE_COLUMNS)[number]
    : never;
