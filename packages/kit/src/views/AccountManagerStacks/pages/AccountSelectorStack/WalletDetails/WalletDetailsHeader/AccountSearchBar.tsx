import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import {
  ActionList,
  IconButton,
  InputUnControlled,
  XStack,
} from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { BatchCreateAccountButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletEdit/BatchCreateAccountButton';
import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useAddAccount } from '../hooks/useAddAccount';

export function AccountSearchBar({
  searchText,
  onSearchTextChange,
  num,
  isOthersUniversal,
  focusedWalletInfo,
}: {
  searchText: string;
  onSearchTextChange: (text: string) => void;
  num: number;
  isOthersUniversal: boolean;
  focusedWalletInfo:
    | {
        wallet: IDBWallet;
        device: IDBDevice | undefined;
      }
    | undefined;
}) {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num });
  const { handleAddAccount } = useAddAccount({
    num,
    isOthersUniversal,
    focusedWalletInfo,
  });

  const handleSearch = useDebouncedCallback((text: string) => {
    onSearchTextChange(text?.trim() || '');
  }, 300);

  const wallet = focusedWalletInfo?.wallet;

  // Check if bulk create account is available
  const canBatchCreateAccount = useMemo(() => {
    if (accountUtils.isQrWallet({ walletId: wallet?.id })) {
      return false;
    }
    if (
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id }) &&
      wallet?.isMocked
    ) {
      return false;
    }
    return (
      accountUtils.isHdWallet({ walletId: wallet?.id }) ||
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id })
    );
  }, [wallet]);

  return (
    <XStack
      mb="$2"
      px="$5"
      py="$2"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="$neutral3"
      alignItems="center"
      gap="$2"
    >
      <InputUnControlled
        leftIconName="SearchOutline"
        size="small"
        allowClear
        placeholder={intl.formatMessage({
          id: ETranslations.global_search_account_selector,
        })}
        containerProps={{
          flex: 1,
          borderRadius: '$full',
          bg: '$bgStrong',
          borderColor: '$transparent',
        }}
        defaultValue={searchText}
        onChangeText={handleSearch}
      />

      <ActionList
        title={intl.formatMessage({ id: ETranslations.global_add_account })}
        renderTrigger={
          <IconButton
            testID="account-search-bar-add-button"
            icon="PlusSmallOutline"
            size="small"
          />
        }
        renderItems={({ handleActionListClose }) => (
          <>
            <ActionList.Item
              testID="add-account-button"
              icon="PlusSmallOutline"
              label={intl.formatMessage({
                id: ETranslations.global_add_account,
              })}
              onClose={handleActionListClose}
              onPress={() => {
                void handleAddAccount();
                handleActionListClose();
              }}
            />
            {canBatchCreateAccount ? (
              <BatchCreateAccountButton
                focusedWalletInfo={focusedWalletInfo}
                activeAccount={activeAccount}
                onClose={handleActionListClose}
              />
            ) : null}
          </>
        )}
      />
    </XStack>
  );
}
