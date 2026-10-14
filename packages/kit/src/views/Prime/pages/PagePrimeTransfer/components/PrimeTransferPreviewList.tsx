import { useCallback, useMemo } from 'react';

import natsort from 'natsort';
import { useIntl } from 'react-intl';

import {
  Button,
  Checkbox,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
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
}: {
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
          <AccountAvatar
            account={account as any}
            networkId={account.createAtNetwork}
          />
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

export function PrimeTransferPreviewList({
  data,
  selectedItemMap,
  onItemSelectChange,
  onGroupSelectChange,
}: IPrimeTransferPreviewListProps) {
  const { wallets, importedAccounts, watchingAccounts } = useMemo(() => {
    const _wallets = Object.values(data.privateData.wallets);
    const _importedAccounts = Object.values(data.privateData.importedAccounts);
    const _watchingAccounts = Object.values(data.privateData.watchingAccounts);
    return {
      wallets: _wallets.toSorted((a, b) => walletSortFn(a, b)),
      importedAccounts: _importedAccounts.toSorted((a, b) =>
        accountSortFn(a, b),
      ),
      watchingAccounts: _watchingAccounts.toSorted((a, b) =>
        accountSortFn(a, b),
      ),
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

  const walletGroupStatus = getGroupSelectStatus('wallet');
  const importedAccountGroupStatus = getGroupSelectStatus('importedAccount');
  const watchingAccountGroupStatus = getGroupSelectStatus('watchingAccount');

  return (
    <Stack gap={1}>
      {wallets?.length ? (
        <PreviewHeader
          title={intl.formatMessage({
            id: ETranslations.global_software_wallet,
          })}
          isFirst
          buttonProps={{
            isAllSelected: walletGroupStatus.isAllSelected,
            onPress: () =>
              onGroupSelectChange?.({
                type: 'wallet',
                selectAll: !walletGroupStatus.isAllSelected,
              }),
          }}
        />
      ) : null}
      {wallets.map((wallet) => (
        <PreviewItem
          key={wallet.id}
          wallet={wallet}
          selectedItemMapInfo={selectedItemMap.wallet}
          onSelect={(id) => onItemSelectChange?.({ type: 'wallet', id })}
        />
      ))}

      {importedAccounts?.length ? (
        <PreviewHeader
          title={intl.formatMessage({
            id: ETranslations.wallet_label_private_key,
          })}
          buttonProps={{
            isAllSelected: importedAccountGroupStatus.isAllSelected,
            onPress: () =>
              onGroupSelectChange?.({
                type: 'importedAccount',
                selectAll: !importedAccountGroupStatus.isAllSelected,
              }),
          }}
        />
      ) : null}
      {importedAccounts.map((account) => (
        <PreviewItem
          key={account.id}
          account={account}
          selectedItemMapInfo={selectedItemMap.importedAccount}
          onSelect={(id) =>
            onItemSelectChange?.({ type: 'importedAccount', id })
          }
        />
      ))}

      {watchingAccounts?.length ? (
        <PreviewHeader
          title={intl.formatMessage({
            id: ETranslations.global_watched,
          })}
          buttonProps={{
            isAllSelected: watchingAccountGroupStatus.isAllSelected,
            onPress: () =>
              onGroupSelectChange?.({
                type: 'watchingAccount',
                selectAll: !watchingAccountGroupStatus.isAllSelected,
              }),
          }}
        />
      ) : null}
      {watchingAccounts.map((account) => (
        <PreviewItem
          key={account.id}
          account={account}
          selectedItemMapInfo={selectedItemMap.watchingAccount}
          onSelect={(id) =>
            onItemSelectChange?.({ type: 'watchingAccount', id })
          }
        />
      ))}
    </Stack>
  );
}
