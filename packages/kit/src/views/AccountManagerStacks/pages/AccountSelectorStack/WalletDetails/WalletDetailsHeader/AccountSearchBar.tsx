import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import {
  ActionList,
  Divider,
  IconButton,
  InputUnControlled,
  XStack,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import {
  useAccountSelectorContextData,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { BatchCreateAccountButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletEdit/BatchCreateAccountButton';
import { BulkCopyAddressesButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletEdit/BulkCopyAddressesButton';
import { usePrimeAvailable } from '@onekeyhq/kit/src/views/Prime/hooks/usePrimeAvailable';
import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { useAddAccount } from '../hooks/useAddAccount';
import { AccountManagerTestIDs } from '../testIDs';

export function AccountSearchBar({
  searchText,
  onSearchTextChange,
  num,
  isOthersUniversal,
  focusedWalletInfo,
  editable,
  currentNetworkId,
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
  editable: boolean;
  currentNetworkId?: string;
}) {
  const intl = useIntl();
  const { config } = useAccountSelectorContextData();
  const { activeAccount } = useActiveAccount({ num });
  const { isPrimeAvailable } = usePrimeAvailable();
  const { user, isPrimeActive } = useOneKeyAuth();
  const { handleAddAccount } = useAddAccount({
    num,
    isOthersUniversal,
    focusedWalletInfo,
  });

  const handleSearch = useDebouncedCallback((text: string) => {
    onSearchTextChange(text?.trim() || '');
  }, 300);

  const wallet = focusedWalletInfo?.wallet;
  const isPrimeUser = Boolean(isPrimeActive && user?.onekeyUserId);

  const showBulkCopyAddressesButton = Boolean(
    isPrimeAvailable &&
    !wallet?.deprecated &&
    wallet?.backuped &&
    (accountUtils.isHdWallet({ walletId: wallet.id }) ||
      accountUtils.isHwWallet({ walletId: wallet.id })),
  );

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
          id: ETranslations.global_search,
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

      {editable ? (
        <ActionList
          title={intl.formatMessage({ id: ETranslations.global_add_account })}
          floatingPanelProps={{
            width: '$72',
          }}
          renderTrigger={
            <IconButton
              testID={AccountManagerTestIDs.searchBarAddButton}
              icon="PlusSmallOutline"
              size="small"
            />
          }
          renderItems={({ handleActionListClose }) =>
            config ? (
              <AccountSelectorProviderMirror enabledNum={[num]} config={config}>
                <ActionList.Item
                  testID={AccountManagerTestIDs.addAccountButton}
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
                    currentNetworkId={currentNetworkId}
                    onClose={handleActionListClose}
                  />
                ) : null}
                {showBulkCopyAddressesButton ? (
                  <>
                    <Divider mx="$2" my="$1" />
                    <BulkCopyAddressesButton
                      wallet={wallet}
                      networkId={
                        currentNetworkId ?? activeAccount.network?.id ?? ''
                      }
                      isPrimeActive={isPrimeActive}
                      isPrimeUser={isPrimeUser}
                      onClose={handleActionListClose}
                      entryPoint="accountSelectorAddMenu"
                    />
                  </>
                ) : null}
              </AccountSelectorProviderMirror>
            ) : null
          }
        />
      ) : null}
    </XStack>
  );
}
