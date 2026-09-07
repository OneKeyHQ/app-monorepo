import { useMemo } from 'react';

import { isEqual } from 'lodash';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountSelectorAccountsListSectionData,
  IAccountSelectorSelectedAccount,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import {
  useAccountSelectorDeFiMapAtom,
  useAccountSelectorValuesMapAtom,
  useActiveAccountValueAtom,
  useCurrencyPersistAtom,
  useIndexedAccountAddressCreationStateAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IAccountSelectorDeFiItem,
  IAccountSelectorValueItem,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { INetworkDeriveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { AccountManagerTestIDs } from '../../../testIDs';
import { accountSelectorAccountVisualV2 } from '../accountSelectorNativeListV2';

import { formatAccountSelectorValueV2 } from './accountSelectorValueV2';

import type {
  IdentityRow,
  NativeListSnapshot,
  NativeListTheme,
  RowPatch,
} from '@onekeyfe/react-native-native-list';

export type IAccountSelectorRowRecordV2 = {
  key: string;
  item: IDBAccount | IDBIndexedAccount;
  account?: IDBAccount;
  indexedAccount?: IDBIndexedAccount;
  section: IAccountSelectorAccountsListSectionData;
  index: number;
  avatarNetworkId?: string;
  shouldShowCreateAddressButton: boolean;
  isCreatingAddress: boolean;
};

export function useAccountSelectorAccountRowsV2({
  num,
  sections,
  selectedAccount,
  wallet,
  linkedNetworkId,
  linkNetwork,
  isOthersUniversal,
  hideAddress,
  allowSelectEmptyAccount,
  editable,
  mergeDeriveAssetsEnabled,
  enabledNetworksCompatibleWithWalletId,
  networkInfoMap,
  theme,
}: {
  num: number;
  sections: IAccountSelectorAccountsListSectionData[];
  selectedAccount: IAccountSelectorSelectedAccount;
  wallet?: IDBWallet;
  linkedNetworkId?: string;
  linkNetwork?: boolean;
  isOthersUniversal: boolean;
  hideAddress?: boolean;
  allowSelectEmptyAccount?: boolean;
  editable: boolean;
  mergeDeriveAssetsEnabled?: boolean;
  enabledNetworksCompatibleWithWalletId: IServerNetwork[];
  networkInfoMap: Record<string, INetworkDeriveInfo>;
  theme: NativeListTheme;
}) {
  const intl = useIntl();
  const {
    activeAccount: { network },
  } = useActiveAccount({ num });
  const [valuesMap] = useAccountSelectorValuesMapAtom();
  const [deFiMap] = useAccountSelectorDeFiMapAtom();
  const [activeAccountValue] = useActiveAccountValueAtom();
  const [addressCreationState] = useIndexedAccountAddressCreationStateAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const records = useMemo(
    () =>
      sections.flatMap((section) =>
        section.data.map((item, index): IAccountSelectorRowRecordV2 => {
          const account = isOthersUniversal ? (item as IDBAccount) : undefined;
          const indexedAccount = isOthersUniversal
            ? undefined
            : (item as IDBIndexedAccount);
          const matchedNetwork =
            isOthersUniversal && account
              ? accountUtils.getAccountCompatibleNetwork({
                  account,
                  networkId: linkNetwork
                    ? linkedNetworkId || selectedAccount.networkId
                    : account.createAtNetwork,
                })
              : undefined;
          const avatarNetworkId =
            matchedNetwork ||
            (indexedAccount && linkNetwork
              ? linkedNetworkId || selectedAccount.networkId
              : undefined);
          const associate = indexedAccount?.associateAccount;
          const isEmptyAddress =
            !isOthersUniversal &&
            !!linkedNetworkId &&
            !associate?.address &&
            !(
              associate?.addressDetail?.isValid &&
              associate.addressDetail.normalizedAddress
            );
          return {
            key: item.id,
            item,
            account,
            indexedAccount,
            section,
            index,
            avatarNetworkId,
            shouldShowCreateAddressButton: !!(linkNetwork && isEmptyAddress),
            isCreatingAddress: !!(
              addressCreationState?.indexedAccountId === indexedAccount?.id &&
              addressCreationState?.walletId === wallet?.id
            ),
          };
        }),
      ),
    [
      sections,
      isOthersUniversal,
      linkNetwork,
      linkedNetworkId,
      selectedAccount.networkId,
      addressCreationState,
      wallet?.id,
    ],
  );
  const networkIdsKey = [
    ...new Set(
      records
        .map((record) => record.avatarNetworkId)
        .filter((id): id is string => !!id),
    ),
  ]
    .toSorted()
    .join(',');
  const { result: avatarNetworks } = usePromiseResult(
    async () => {
      const ids = networkIdsKey ? networkIdsKey.split(',') : [];
      const networks = await Promise.all(
        ids.map(async (id) =>
          backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId: id }),
        ),
      );
      return Object.fromEntries(
        networks
          .filter((item): item is IServerNetwork => !!item)
          .map((item) => [item.id, item]),
      );
    },
    [networkIdsKey],
    { checkIsFocused: false },
  );
  const staticRows = useMemo(
    () =>
      records.map((record): IdentityRow => {
        const {
          account,
          indexedAccount,
          avatarNetworkId,
          item,
          shouldShowCreateAddressButton,
          isCreatingAddress,
        } = record;
        const associate = indexedAccount?.associateAccount;
        const isEmptyAddress =
          !isOthersUniversal &&
          !!linkedNetworkId &&
          !associate?.address &&
          !(
            associate?.addressDetail?.isValid &&
            associate.addressDetail.normalizedAddress
          );
        const rawAddress = account?.address || associate?.address || '';
        const address = accountUtils.shortenAddress({
          address: accountUtils.shortenAddress({ address: rawAddress }),
          leadingLength: 6,
          trailingLength: 4,
        });
        const subtitleSegments: NonNullable<
          IdentityRow['subtitleSegments']
        >[number][] = [];
        if (
          (isEmptyAddress || isOthersUniversal || !hideAddress) &&
          (address || isEmptyAddress)
        ) {
          subtitleSegments.push({
            text: isEmptyAddress
              ? intl.formatMessage({ id: ETranslations.wallet_no_address })
              : address,
            tone: isEmptyAddress ? 'caution' : 'secondary',
            separatorBefore: !(platformEnv.isWebDappMode || platformEnv.isE2E),
          });
        }
        let trailing: IdentityRow['trailing'] = [];
        if (isCreatingAddress) trailing = [{ kind: 'spinner' }];
        else if (shouldShowCreateAddressButton)
          trailing = [
            {
              kind: 'icon',
              name: 'PlusSmallOutline',
              tintColor: theme.iconSubdued,
              testID: 'account-manager-plus-button-icon-btn',
              actionKey: 'create-address',
            },
          ];
        else if (editable)
          trailing = [
            {
              kind: 'icon',
              name: 'DotHorOutline',
              tintColor: theme.iconSubdued,
              testID: AccountManagerTestIDs.accountEditButton(item.name),
              actionKey: 'account-more',
            },
          ];
        return {
          type: 'identity',
          presentation: 'accountSelector',
          key: item.id,
          testID: AccountManagerTestIDs.accountItem(record.index),
          height: 60,
          title: item.name,
          leading: accountSelectorAccountVisualV2({
            account,
            indexedAccount,
            network: avatarNetworkId
              ? (avatarNetworks?.[avatarNetworkId] ??
                networkUtils.getLocalNetworkInfo(avatarNetworkId))
              : undefined,
            theme,
          }),
          selected: isOthersUniversal
            ? selectedAccount.othersWalletAccountId === item.id
            : selectedAccount.indexedAccountId === item.id,
          subtitleSegments,
          pressDisabled:
            isCreatingAddress ||
            (!allowSelectEmptyAccount && shouldShowCreateAddressButton),
          trailing,
          accessibilityLabel: [
            item.name,
            ...subtitleSegments.map((segment) => segment.text),
          ].join(', '),
        };
      }),
    [
      records,
      isOthersUniversal,
      linkedNetworkId,
      hideAddress,
      intl,
      avatarNetworks,
      theme,
      selectedAccount.othersWalletAccountId,
      selectedAccount.indexedAccountId,
      allowSelectEmptyAccount,
      editable,
    ],
  );
  // Each cache belongs to the formatting context; weak keys retain only live rows.
  const getValueRow = useMemo(() => {
    const cache = new WeakMap<
      IdentityRow,
      {
        accountValue?: IAccountSelectorValueItem;
        overview?: IAccountSelectorDeFiItem;
        row: IdentityRow;
      }
    >();
    return (
      row: IdentityRow,
      record: IAccountSelectorRowRecordV2,
      accountValue?: IAccountSelectorValueItem,
      overview?: IAccountSelectorDeFiItem,
    ): IdentityRow => {
      if (
        platformEnv.isWebDappMode ||
        platformEnv.isE2E ||
        record.shouldShowCreateAddressButton
      ) {
        return row;
      }
      const cached = cache.get(row);
      if (
        cached &&
        isEqual(cached.accountValue, accountValue) &&
        isEqual(cached.overview, overview)
      ) {
        return cached.row;
      }
      const value = formatAccountSelectorValueV2({
        accountValue,
        activeAccountValue,
        overview,
        walletId: wallet?.id ?? '',
        linkedAccountId:
          record.indexedAccount?.associateAccount?.id ?? record.item.id,
        linkedNetworkId: record.avatarNetworkId ?? network?.id,
        mergeDeriveAssetsEnabled,
        enabledNetworksCompatibleWithWalletId,
        networkInfoMap,
        currencyMap,
        targetCurrency: currencyInfo.id,
        hideValue: !!settingsValue.hideValue,
      });
      const subtitleSegments = [value, ...(row.subtitleSegments ?? [])];
      const valueRow: IdentityRow = {
        ...row,
        subtitleSegments,
        accessibilityLabel: [
          row.title,
          ...subtitleSegments.map((segment) => segment.text),
        ].join(', '),
      };
      cache.set(row, { accountValue, overview, row: valueRow });
      return valueRow;
    };
  }, [
    activeAccountValue,
    wallet?.id,
    network?.id,
    mergeDeriveAssetsEnabled,
    enabledNetworksCompatibleWithWalletId,
    networkInfoMap,
    currencyMap,
    currencyInfo.id,
    settingsValue.hideValue,
  ]);
  // Balance batches must not rebuild avatars or other static row presentation.
  const rows = useMemo(
    () =>
      staticRows.map((row, index) =>
        getValueRow(
          row,
          records[index],
          valuesMap[num]?.[row.key],
          deFiMap[num]?.[row.key],
        ),
      ),
    [staticRows, records, getValueRow, valuesMap, num, deFiMap],
  );
  return { records, rows };
}

const accountRowPatchFieldsV2 = new Set<keyof IdentityRow>([
  'title',
  'leading',
  'selected',
  'subtitleSegments',
  'pressDisabled',
  'trailing',
  'accessibilityLabel',
]);

export function buildAccountSelectorRowPatchesV2(
  previous: NativeListSnapshot,
  next: NativeListSnapshot,
): RowPatch[] | undefined {
  const { rows: previousRows, ...previousMetadata } = previous;
  const { rows: nextRows, ...nextMetadata } = next;
  if (
    previousRows.length !== nextRows.length ||
    !isEqual(previousMetadata, nextMetadata)
  ) {
    return undefined;
  }
  const patches: RowPatch[] = [];
  for (let index = 0; index < nextRows.length; index += 1) {
    const row = nextRows[index];
    const previousRow = previousRows[index];
    if (row.key !== previousRow.key || row.type !== previousRow.type) {
      return undefined;
    }
    if (row.type !== 'identity' || previousRow.type !== 'identity') {
      if (!isEqual(row, previousRow)) return undefined;
    } else if (row !== previousRow) {
      const fields = new Set([
        ...Object.keys(previousRow),
        ...Object.keys(row),
      ] as (keyof IdentityRow)[]);
      const changedFields: (keyof IdentityRow)[] = [];
      for (const field of fields) {
        if (!isEqual(row[field], previousRow[field])) {
          // Undefined fields are omitted by JSON; a snapshot is needed to clear them.
          if (!accountRowPatchFieldsV2.has(field) || row[field] === undefined) {
            return undefined;
          }
          changedFields.push(field);
        }
      }
      if (changedFields.length) {
        patches.push({
          type: 'identity',
          key: row.key,
          changes: Object.fromEntries(
            changedFields.map((field) => [field, row[field]]),
          ) as Extract<RowPatch, { type: 'identity' }>['changes'],
        });
      }
    }
  }
  return patches;
}
