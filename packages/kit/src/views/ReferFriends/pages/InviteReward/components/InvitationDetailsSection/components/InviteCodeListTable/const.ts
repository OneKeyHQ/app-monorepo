/**
 * Column data index enum for InviteCodeListTable
 */
export enum EInviteCodeListTableColumn {
  CODE = 'code',
  NOTE = 'note',
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
 * Type for sortable columns
 */
export type ISortableColumn =
  (typeof SORTABLE_COLUMNS)[number] extends EInviteCodeListTableColumn
    ? (typeof SORTABLE_COLUMNS)[number]
    : never;
