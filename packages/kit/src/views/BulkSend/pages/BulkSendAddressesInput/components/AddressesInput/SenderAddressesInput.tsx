import { useCallback, useEffect, useRef, useState } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Form,
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useDebouncedValidation } from '@onekeyhq/kit/src/views/BulkSend/hooks/useDebouncedValidation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EInputAddressChangeType,
  type IAddressBadge,
} from '@onekeyhq/shared/types/address';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';

import { useBulkSendAddressesInputContext } from '../Context';

import LineNumberedTextArea from './LineNumberedTextArea';

function SenderAddressesInput() {
  const intl = useIntl();
  const {
    selectedAccountId,
    selectedNetworkId,
    selectedIndexedAccountId,
    setSelectedAccountId,
    setSelectedIndexedAccountId,
    selectedTokenDetail,
    tokenDetailsState,
    bulkSendMode,
  } = useBulkSendAddressesInputContext();
  const { network } = useAccountData({ networkId: selectedNetworkId });
  const [addressBadges, setAddressBadges] = useState<IAddressBadge[]>([]);

  // Use refs to store latest values for validation closure
  const selectedAccountIdRef = useRef(selectedAccountId);
  const selectedIndexedAccountIdRef = useRef(selectedIndexedAccountId);

  const handleValidateAddresses = useCallback(
    async (_value: string) => {
      if (!_value) {
        setAddressBadges([]);
        return intl.formatMessage({
          id: ETranslations.wallet_bulk_send_error_sender_required,
        });
      }

      const result =
        await backgroundApiProxy.serviceValidator.localValidateAddress({
          networkId: selectedNetworkId ?? '',
          address: _value.trim(),
        });

      if (result.isValid) {
        try {
          // wallet order: hw -> qr -> hd -> imported -> external -> watching
          const walletAccountItems =
            await backgroundApiProxy.serviceAccount.getAccountNameFromAddress({
              networkId: selectedNetworkId ?? '',
              address: _value.trim(),
            });

          if (isEmpty(walletAccountItems)) {
            return intl.formatMessage({
              id: ETranslations.wallet_bulk_send_error_address_not_found,
            });
          }

          let accountItem:
            | { walletName: string; accountName: string; accountId: string }
            | undefined;

          // Use refs to get the latest values (avoid closure stale state issue)
          const currentAccountId = selectedAccountIdRef.current;
          const currentIndexedAccountId = selectedIndexedAccountIdRef.current;

          if (currentAccountId || currentIndexedAccountId) {
            accountItem = walletAccountItems.find((item) => {
              if (currentIndexedAccountId) {
                return item.accountId === currentIndexedAccountId;
              }
              return item.accountId === currentAccountId;
            });
          }

          let isWatchingAccount = false;

          if (accountItem) {
            setAddressBadges([
              {
                label: `${accountItem.walletName} / ${accountItem.accountName}`,
                type: 'success',
              },
            ]);
            isWatchingAccount = accountUtils.isWatchingAccount({
              accountId: accountItem.accountId,
            });
          } else {
            setAddressBadges(
              walletAccountItems[0]
                ? [
                    {
                      label: `${walletAccountItems[0].walletName} / ${walletAccountItems[0].accountName}`,
                      type: 'success',
                    },
                  ]
                : [],
            );
            for (const item of walletAccountItems) {
              if (
                accountUtils.isHdAccount({ accountId: item.accountId }) ||
                accountUtils.isHwAccount({ accountId: item.accountId })
              ) {
                const networkAccounts =
                  await backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountId(
                    {
                      indexedAccountId: item.accountId,
                      networkIds: [selectedNetworkId ?? ''],
                    },
                  );
                if (networkAccounts[0].account) {
                  // Update refs immediately before setState
                  selectedAccountIdRef.current = networkAccounts[0].account.id;
                  selectedIndexedAccountIdRef.current = item.accountId;
                  setSelectedAccountId(networkAccounts[0].account.id);
                  setSelectedIndexedAccountId(item.accountId);
                  return true;
                }
              } else if (
                accountUtils.isExternalAccount({ accountId: item.accountId }) ||
                accountUtils.isImportedAccount({ accountId: item.accountId })
              ) {
                // Update refs immediately before setState
                selectedAccountIdRef.current = item.accountId;
                selectedIndexedAccountIdRef.current = undefined;
                setSelectedAccountId(item.accountId);
                setSelectedIndexedAccountId(undefined);
                break;
              } else if (
                accountUtils.isWatchingAccount({ accountId: item.accountId })
              ) {
                isWatchingAccount = true;
                break;
              }
            }
          }

          if (isWatchingAccount) {
            return intl.formatMessage({
              id: ETranslations.wallet_bulk_send_error_watching_account,
            });
          }

          return true;
        } catch (_) {
          setAddressBadges([]);
          return intl.formatMessage({
            id: ETranslations.wallet_bulk_send_error_address_not_found,
          });
        }
      }
      setAddressBadges([]);
      return intl.formatMessage(
        { id: ETranslations.wallet_bulk_send_error_invalid_network_address },
        { network: network?.name ?? '' },
      );
    },
    [
      intl,
      network?.name,
      selectedNetworkId,
      setSelectedAccountId,
      setSelectedIndexedAccountId,
    ],
  );

  const debouncedValidateAddresses = useDebouncedValidation(
    handleValidateAddresses,
  );

  const renderSenderAddressesDescription = useCallback(() => {
    if (tokenDetailsState.initialized) {
      return (
        <XStack alignItems="center" gap="$1" mt="$1.5">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.wallet_bulk_send_balance })}
          </SizableText>
          <NumberSizeableText
            formatter="balance"
            size="$bodyMd"
            color="$textSubdued"
            formatterOptions={{ tokenSymbol: selectedTokenDetail?.info.symbol }}
          >
            {selectedTokenDetail?.balanceParsed ?? '-'}
          </NumberSizeableText>
        </XStack>
      );
    }

    if (tokenDetailsState.isRefreshing) {
      return (
        <XStack alignItems="center" gap="$1" mt="$1.5">
          <Skeleton.BodyMd width="$40" />
        </XStack>
      );
    }
    return null;
  }, [
    intl,
    tokenDetailsState.initialized,
    tokenDetailsState.isRefreshing,
    selectedTokenDetail?.info.symbol,
    selectedTokenDetail?.balanceParsed,
  ]);

  const handleActiveAccountChange = useCallback(
    (activeAccount: IAccountSelectorActiveAccountInfo) => {
      if (activeAccount.account?.id) {
        selectedAccountIdRef.current = activeAccount.account.id;
        setSelectedAccountId(activeAccount.account.id);
      }
      if (activeAccount.indexedAccount?.id) {
        selectedIndexedAccountIdRef.current = activeAccount.indexedAccount.id;
        setSelectedIndexedAccountId(activeAccount.indexedAccount.id);
      } else {
        selectedIndexedAccountIdRef.current = undefined;
        setSelectedIndexedAccountId(undefined);
      }
    },
    [setSelectedAccountId, setSelectedIndexedAccountId],
  );

  const handleInputTypeChange = useCallback((type: EInputAddressChangeType) => {
    if (type !== EInputAddressChangeType.AccountSelector) {
      selectedAccountIdRef.current = undefined;
      selectedIndexedAccountIdRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    selectedAccountIdRef.current = selectedAccountId;
    selectedIndexedAccountIdRef.current = selectedIndexedAccountId;
  }, [selectedAccountId, selectedIndexedAccountId]);

  return (
    <Form.Field
      name="senderAddresses"
      label={intl.formatMessage({
        id:
          bulkSendMode === EBulkSendMode.OneToMany
            ? ETranslations.wallet_bulk_send_section_sending_address
            : ETranslations.wallet_bulk_send_label_sending_addresses,
      })}
      description={renderSenderAddressesDescription()}
      rules={{
        validate: debouncedValidateAddresses,
      }}
    >
      <LineNumberedTextArea
        singleLine
        showAddressBadges
        addressBadges={addressBadges}
        showPaste
        // TODO: init account selector with selected account id or indexed account id
        showAccountSelector
        placeholder={intl.formatMessage({
          id: ETranslations.wallet_bulk_send_placeholder_address,
        })}
        showLineNumbers={false}
        accountSelector={{
          num: 0,
          clearNotMatch: true,
          accountSelectorOnly: true,
        }}
        networkId={selectedNetworkId}
        accountId={selectedAccountId}
        onActiveAccountChange={handleActiveAccountChange}
        onInputTypeChange={handleInputTypeChange}
      />
    </Form.Field>
  );
}

export default SenderAddressesInput;
