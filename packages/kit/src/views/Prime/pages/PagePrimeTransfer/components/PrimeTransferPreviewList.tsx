import { useCallback, useMemo } from 'react';

import natsort from 'natsort';
import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  ListView,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { TokenListViewContext } from '@onekeyhq/kit/src/components/TokenListView/TokenListViewContext';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type {
  IDBAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IPrimeTransferAccount,
  IPrimeTransferHDWallet,
  IPrimeTransferSelectedItemMap,
  IPrimeTransferSelectedItemMapInfo,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import { usePrimeTransferPreviewNetworks } from './usePrimeTransferPreviewNetworks';

import type { IPrimeTransferPreviewListProps } from './PrimeTransferPreviewList.types';

function PreviewHeader({
  title,
  isFirst = false,
  buttonProps,
}: {
  title: string;
  isFirst?: boolean;
  buttonProps?: {
    isAllSelected: boolean;
    onPress: () => void;
  };
}) {
  const intl = useIntl();

  return (
    <XStack
      mt={isFirst ? '$0' : '$4'}
      mb="$2"
      alignItems="center"
      justifyContent="space-between"
    >
      <SizableText pl="$3" size="$headingSm" color="$textSubdued">
        {title}
      </SizableText>
      <XStack pr="$2.5">
        {buttonProps ? (
          <Button
            size="small"
            variant="tertiary"
            onPress={buttonProps.onPress}
            testID="prime-intl-btn"
          >
            {intl.formatMessage({
              id: buttonProps.isAllSelected
                ? ETranslations.global_deselect_all
                : ETranslations.global_select_all,
            })}
          </Button>
        ) : null}
      </XStack>
    </XStack>
  );
}

function PreviewItem({
  wallet,
  account,
  onSelect,
  selectedItemMapInfo,
  networkId,
}: {
  networkId?: string;
  wallet?: IPrimeTransferHDWallet;
  account?: IPrimeTransferAccount;
  onSelect: (id: string) => void;
  selectedItemMapInfo: IPrimeTransferSelectedItemMapInfo;
}) {
  const intl = useIntl();
  const itemId = wallet?.id || account?.id || '';
  const onChange = useCallback(() => {
    if (!selectedItemMapInfo?.[itemId]?.disabled) {
      onSelect?.(itemId);
    } else {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.transfer_web_only_supports_watch_only_transfer,
        }),
      });
    }
  }, [itemId, onSelect, selectedItemMapInfo, intl]);

  return (
    <Stack
      opacity={selectedItemMapInfo?.[itemId]?.disabled ? 0.5 : 1}
      onPress={() => {
        onChange();
      }}
      px="$3"
      py="$2"
      borderRadius="$3"
      backgroundColor="$bgSubdued"
      hoverStyle={{
        backgroundColor: '$bgHover',
      }}
      cursor="pointer"
    >
      <XStack gap="$3" alignItems="center" flex={1}>
        {wallet?.avatarInfo ? (
          <WalletAvatar wallet={wallet as unknown as IDBWallet} />
        ) : null}
        {account ? (
          <AccountAvatar account={account as any} networkId={networkId} />
        ) : null}
        <YStack flex={1}>
          <SizableText
            numberOfLines={1}
            size="$bodyLgMedium"
            color="$text"
            w="100%"
          >
            {wallet?.name || account?.name}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {wallet
              ? intl.formatMessage(
                  {
                    id: ETranslations.global_transfer_accounts_count,
                  },
                  {
                    amount:
                      wallet?.indexedAccountUUIDs?.length ||
                      wallet?.indexedAccountUUIDsLength ||
                      0,
                  },
                )
              : accountUtils.shortenAddress({
                  address: account?.address || '',
                  leadingLength: 6,
                  trailingLength: 4,
                })}
          </SizableText>
        </YStack>
        <Stack w="$5">
          <Checkbox
            testID="prime-checkbox"
            disabled={selectedItemMapInfo[itemId].disabled}
            shouldStopPropagation
            value={selectedItemMapInfo[itemId].checked}
            onChange={() => {
              onChange();
            }}
            onChangeForDisabled={() => {
              onChange();
            }}
          />
        </Stack>
      </XStack>
    </Stack>
  );
}

const accountSortFn = (
  a: IDBAccount | IPrimeTransferAccount,
  b: IDBAccount | IPrimeTransferAccount,
) =>
  natsort({ insensitive: true })(
    a.accountOrder ?? a.accountOrderSaved ?? 0,
    b.accountOrder ?? b.accountOrderSaved ?? 0,
  );

const walletSortFn = (a: IPrimeTransferHDWallet, b: IPrimeTransferHDWallet) =>
  natsort({ insensitive: true })(
    a.walletOrder ?? a.walletOrderSaved ?? 0,
    b.walletOrder ?? b.walletOrderSaved ?? 0,
  );

type IGroup = keyof IPrimeTransferSelectedItemMap;
type IPreviewRow =
  | {
      kind: 'header';
      key: string;
      type: IGroup;
      title: string;
      isFirst: boolean;
    }
  | {
      kind: 'wallet';
      key: string;
      type: 'wallet';
      wallet: IPrimeTransferHDWallet;
    }
  | {
      kind: 'account';
      key: string;
      type: 'importedAccount' | 'watchingAccount';
      account: IPrimeTransferAccount;
    };
const LIST_CONTENT_STYLE = { paddingHorizontal: 20, paddingBottom: 20 };
const previewRowKey = (row: IPreviewRow) => row.key;

export function PrimeTransferPreviewList({
  data,
  selectedItemMap,
  onItemSelectChange,
  onGroupSelectChange,
}: IPrimeTransferPreviewListProps) {
  const { wallets, importedAccounts, watchingAccounts } = useMemo(() => {
    const walletItems = Object.values(data.privateData.wallets);
    const importedItems = Object.values(data.privateData.importedAccounts);
    const watchingItems = Object.values(data.privateData.watchingAccounts);
    return {
      wallets: walletItems.toSorted((a, b) => walletSortFn(a, b)),
      importedAccounts: importedItems.toSorted((a, b) => accountSortFn(a, b)),
      watchingAccounts: watchingItems.toSorted((a, b) => accountSortFn(a, b)),
    };
  }, [data]);

  const intl = useIntl();

  const getGroupSelectStatus = useCallback(
    (type: keyof IPrimeTransferSelectedItemMap) => {
      const items = selectedItemMap[type];
      const availableItems = Object.values(items).filter(
        (item) => !item.disabled,
      );
      const selectedItems = availableItems.filter((item) => item.checked);

      return {
        isAllSelected:
          selectedItems.length === availableItems.length &&
          availableItems.length > 0,
      };
    },
    [selectedItemMap],
  );

  const networksMap = usePrimeTransferPreviewNetworks(data);
  const networkContext = useMemo(() => ({ networksMap }), [networksMap]);
  const rows = useMemo(() => {
    const result: IPreviewRow[] = [];
    const addGroup = (type: IGroup, title: string, items: IPreviewRow[]) => {
      if (!items.length) return;
      result.push({
        kind: 'header',
        key: `header:${type}`,
        type,
        title,
        isFirst: result.length === 0,
      });
      for (const item of items) result.push(item);
    };
    addGroup(
      'wallet',
      intl.formatMessage({ id: ETranslations.global_software_wallet }),
      wallets.map((wallet) => ({
        kind: 'wallet',
        key: `wallet:${wallet.id}`,
        type: 'wallet',
        wallet,
      })),
    );
    addGroup(
      'importedAccount',
      intl.formatMessage({ id: ETranslations.wallet_label_private_key }),
      importedAccounts.map((account) => ({
        kind: 'account',
        key: `importedAccount:${account.id}`,
        type: 'importedAccount',
        account,
      })),
    );
    addGroup(
      'watchingAccount',
      intl.formatMessage({ id: ETranslations.global_watched }),
      watchingAccounts.map((account) => ({
        kind: 'account',
        key: `watchingAccount:${account.id}`,
        type: 'watchingAccount',
        account,
      })),
    );
    return result;
  }, [wallets, importedAccounts, watchingAccounts, intl]);
  const renderItem = useCallback(
    ({ item }: { item: IPreviewRow }) => {
      if (item.kind === 'header') {
        const { isAllSelected } = getGroupSelectStatus(item.type);
        return (
          <PreviewHeader
            title={item.title}
            isFirst={item.isFirst}
            buttonProps={{
              isAllSelected,
              onPress: () =>
                onGroupSelectChange?.({
                  type: item.type,
                  selectAll: !isAllSelected,
                }),
            }}
          />
        );
      }
      const account = item.kind === 'account' ? item.account : undefined;
      // Do not mount per-row network lookups while the batch is pending or absent.
      const networkId = account?.createAtNetwork;
      return (
        <Stack pb={1}>
          <PreviewItem
            wallet={item.kind === 'wallet' ? item.wallet : undefined}
            account={account}
            networkId={
              networkId && networksMap[networkId] ? networkId : undefined
            }
            selectedItemMapInfo={selectedItemMap[item.type]}
            onSelect={(id) => onItemSelectChange?.({ type: item.type, id })}
          />
        </Stack>
      );
    },
    [
      getGroupSelectStatus,
      networksMap,
      onGroupSelectChange,
      onItemSelectChange,
      selectedItemMap,
    ],
  );

  return (
    <TokenListViewContext.Provider value={networkContext}>
      <ListView<IPreviewRow>
        testID="prime-transfer-preview-list"
        flex={1}
        minHeight={0}
        data={rows}
        renderItem={renderItem}
        keyExtractor={previewRowKey}
        extraData={selectedItemMap}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        contentContainerStyle={LIST_CONTENT_STYLE}
      />
    </TokenListViewContext.Provider>
  );
}
