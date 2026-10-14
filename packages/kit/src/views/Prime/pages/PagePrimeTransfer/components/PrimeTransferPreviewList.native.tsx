import { useCallback, useMemo } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  accountSelectorAccountVisualV2,
  accountSelectorWalletVisualV2,
  useAccountSelectorNativeListThemeV2,
} from '@onekeyhq/kit/src/views/AccountManagerStacks/pages/AccountSelectorStack/accountSelectorNativeListV2';
import type {
  IDBAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IPrimeTransferSelectedItemMap } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import type { IPrimeTransferPreviewListProps } from './PrimeTransferPreviewList.types';
import type {
  IdentityRow,
  NativeListSnapshot,
  RowActionEvent,
  RowModel,
  SelectionDeltaEvent,
} from '@onekeyfe/react-native-native-list';

type IGroup = keyof IPrimeTransferSelectedItemMap;
type IPreviewRow = { id: string; row: IdentityRow };
const LIST_STYLE = { flex: 1 };

export function PrimeTransferPreviewList({
  data,
  selectedItemMap,
  onItemSelectChange,
  onGroupSelectChange,
}: IPrimeTransferPreviewListProps) {
  const intl = useIntl();
  const theme = useAccountSelectorNativeListThemeV2();
  const accounts = useMemo(
    () => [
      ...Object.values(data.privateData.importedAccounts),
      ...Object.values(data.privateData.watchingAccounts),
    ],
    [data],
  );
  const networkIds = useMemo(
    () => [
      ...new Set(
        accounts
          .map((account) => account.createAtNetwork)
          .filter((id): id is string => !!id),
      ),
    ],
    [accounts],
  );
  // Resolve badges once per network, not once per mounted account row.
  const { result: networks } = usePromiseResult(
    async () =>
      networkIds.length
        ? (
            await backgroundApiProxy.serviceNetwork.getNetworksByIds({
              networkIds,
            })
          ).networks
        : [],
    [networkIds],
  );
  const networksById = useMemo(
    () => new Map(networks?.map((network) => [network.id, network])),
    [networks],
  );
  const groups = useMemo(() => {
    const compare = natsort({ insensitive: true });
    const accountRows = (items: typeof accounts, type: IGroup): IPreviewRow[] =>
      items
        .toSorted((a, b) =>
          compare(
            a.accountOrder ?? a.accountOrderSaved ?? 0,
            b.accountOrder ?? b.accountOrderSaved ?? 0,
          ),
        )
        .map((account) => ({
          id: account.id,
          row: {
            type: 'identity',
            key: `${type}:${account.id}`,
            sectionKey: type,
            height: 64,
            title: account.name,
            subtitle: accountUtils.shortenAddress({
              address: account.address || '',
              leadingLength: 6,
              trailingLength: 4,
            }),
            // Transfer records carry the address/id fields consumed by the visual adapter.
            leading: accountSelectorAccountVisualV2({
              account: account as IDBAccount,
              network: account.createAtNetwork
                ? (networksById.get(account.createAtNetwork) ??
                  networkUtils.getLocalNetworkInfo(account.createAtNetwork))
                : undefined,
              theme,
            }),
            style: { container: { cornerRadius: 12 }, horizontalPadding: 12 },
          },
        }));
    return [
      {
        type: 'wallet' as const,
        title: intl.formatMessage({ id: ETranslations.global_software_wallet }),
        items: Object.values(data.privateData.wallets)
          .toSorted((a, b) =>
            compare(
              a.walletOrder ?? a.walletOrderSaved ?? 0,
              b.walletOrder ?? b.walletOrderSaved ?? 0,
            ),
          )
          .map(
            (wallet): IPreviewRow => ({
              id: wallet.id,
              row: {
                type: 'identity',
                key: `wallet:${wallet.id}`,
                sectionKey: 'wallet',
                height: 64,
                title: wallet.name,
                subtitle: intl.formatMessage(
                  { id: ETranslations.global_transfer_accounts_count },
                  {
                    amount:
                      wallet.indexedAccountUUIDs?.length ||
                      wallet.indexedAccountUUIDsLength ||
                      0,
                  },
                ),
                // The shared visual adapter reads wallet identity/avatar fields only.
                leading: accountSelectorWalletVisualV2({
                  wallet: wallet as unknown as IDBWallet,
                  badgeBackground: theme.rowBackground,
                  connectionColor: theme.accent,
                  theme,
                }),
                style: {
                  container: { cornerRadius: 12 },
                  horizontalPadding: 12,
                },
              },
            }),
          ),
      },
      {
        type: 'importedAccount' as const,
        title: intl.formatMessage({
          id: ETranslations.wallet_label_private_key,
        }),
        items: accountRows(
          Object.values(data.privateData.importedAccounts),
          'importedAccount',
        ),
      },
      {
        type: 'watchingAccount' as const,
        title: intl.formatMessage({ id: ETranslations.global_watched }),
        items: accountRows(
          Object.values(data.privateData.watchingAccounts),
          'watchingAccount',
        ),
      },
    ];
  }, [data, intl, networksById, theme]);
  const selection = useMemo(() => {
    const byKey = new Map<
      string,
      { type: IGroup; id: string; disabled: boolean }
    >();
    const allSelected = new Map<IGroup, boolean>();
    const selectedKeys: string[] = [];
    const rows: RowModel[] = [];
    for (const group of groups) {
      if (!group.items.length) continue;
      let enabledCount = 0;
      let checkedCount = 0;
      for (const { id, row } of group.items) {
        const state = selectedItemMap[group.type][id];
        byKey.set(row.key, {
          type: group.type,
          id,
          disabled: !state || state.disabled,
        });
        if (state && !state.disabled) {
          enabledCount += 1;
          if (state.checked) checkedCount += 1;
        }
        if (state?.checked) selectedKeys.push(row.key);
      }
      const isAllSelected = enabledCount > 0 && checkedCount === enabledCount;
      allSelected.set(group.type, isAllSelected);
      rows.push({
        type: 'sectionHeader',
        key: `header:${group.type}`,
        sectionKey: group.type,
        title: group.title,
        value: intl.formatMessage({
          id: isAllSelected
            ? ETranslations.global_deselect_all
            : ETranslations.global_select_all,
        }),
        valueActionKey: 'toggle-group',
        height: 48,
        sticky: false,
      });
      for (const { id, row } of group.items) {
        const state = selectedItemMap[group.type][id];
        rows.push({
          ...row,
          disabled: !state || state.disabled,
          trailing: [
            {
              kind: 'checkbox',
              state: state?.checked ? 'checked' : 'unchecked',
              disabled: !state || state.disabled,
              target: { scope: 'row' },
            },
          ],
        });
      }
    }
    return { rows, selectedKeys, byKey, allSelected };
  }, [groups, intl, selectedItemMap]);
  const snapshot = useMemo<NativeListSnapshot>(
    () => ({
      schemaVersion: 1,
      generation: 1,
      theme: {
        ...theme,
        rowBackground: theme.subduedBackground ?? theme.rowBackground,
        rowSelectedBackground: theme.subduedBackground ?? theme.rowBackground,
      },
      layout: {
        kind: 'sectioned',
        stickyHeaders: false,
        contentPaddingHorizontal: 20,
        contentPaddingBottom: 20,
        itemSpacing: 1,
      },
      rows: selection.rows,
      selection: {
        mode: 'multiple',
        selectedKeys: selection.selectedKeys,
        rowPressToggles: true,
      },
    }),
    [selection, theme],
  );
  const onSelectionDelta = useCallback(
    (event: SelectionDeltaEvent) => {
      const update = (key: string, checked: boolean) => {
        const item = selection.byKey.get(key);
        if (item && !item.disabled)
          onItemSelectChange?.({ type: item.type, id: item.id, checked });
      };
      event.addedKeys.forEach((key) => update(key, true));
      event.removedKeys.forEach((key) => update(key, false));
    },
    [onItemSelectChange, selection.byKey],
  );
  const onRowAction = useCallback(
    (event: RowActionEvent) => {
      if (event.actionKey !== 'toggle-group') return;
      const group = groups.find(
        (item) => `header:${item.type}` === event.rowKey,
      );
      if (group)
        onGroupSelectChange?.({
          type: group.type,
          selectAll: !selection.allSelected.get(group.type),
        });
    },
    [groups, onGroupSelectChange, selection.allSelected],
  );

  return (
    <NativeList
      style={LIST_STYLE}
      testID="prime-transfer-preview-list"
      snapshot={snapshot}
      onSelectionDelta={onSelectionDelta}
      onRowAction={onRowAction}
    />
  );
}
