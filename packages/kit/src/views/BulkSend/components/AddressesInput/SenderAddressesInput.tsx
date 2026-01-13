import { useCallback, useState } from 'react';

import { isEmpty } from 'lodash';

import {
  Form,
  NumberSizeableText,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';

import { useBulkSendContext } from '../BulkSendContext';

import LineNumberedTextArea from './LineNumberedTextArea';

function SenderAddressesInput() {
  const {
    selectedAccountId,
    selectedNetworkId,
    selectedIndexedAccountId,
    setSelectedAccountId,
    setSelectedIndexedAccountId,
    selectedTokenDetail,
    tokenDetailsState,
  } = useBulkSendContext();
  const { network } = useAccountData({ networkId: selectedNetworkId });
  const [addressBadges, setAddressBadges] = useState<IAddressBadge[]>([]);

  const handleValidateAddresses = useCallback(
    async (_value: string) => {
      if (!_value) {
        setAddressBadges([]);
        return 'Sender address is required';
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

          if (isEmpty(walletAccountItems)) {
            return 'Address not found in your wallet';
          }

          let isWatchingAccount = false;

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
                setSelectedAccountId(networkAccounts[0].account.id);
                setSelectedIndexedAccountId(item.accountId);
                return true;
              }
            } else if (
              accountUtils.isExternalAccount({ accountId: item.accountId }) ||
              accountUtils.isImportedAccount({ accountId: item.accountId })
            ) {
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

          if (isWatchingAccount) {
            return 'Address is a watching account';
          }

          return true;
        } catch (e) {
          setAddressBadges([]);
          return 'Address not found in your wallet';
        }
      }
      setAddressBadges([]);
      return `Not a valid ${network?.name ?? ''} address`;
    },
    [
      network?.name,
      selectedNetworkId,
      setSelectedAccountId,
      setSelectedIndexedAccountId,
    ],
  );

  const renderSenderAddressesDescription = useCallback(() => {
    if (tokenDetailsState.initialized) {
      return (
        <XStack alignItems="center" gap="$1" mt="$1.5">
          <SizableText size="$bodyMd" color="$textSubdued">
            Balance:
          </SizableText>
          <NumberSizeableText
            formatter="balance"
            size="$bodyMd"
            color="$textSubdued"
            formatterOptions={{ tokenSymbol: selectedTokenDetail?.info.symbol }}
          >
            {selectedTokenDetail?.balanceParsed}
          </NumberSizeableText>
        </XStack>
      );
    }

    if (tokenDetailsState.isRefreshing) {
      return <Skeleton.BodyMd mt="$1.5" />;
    }
    return null;
  }, [
    tokenDetailsState.initialized,
    tokenDetailsState.isRefreshing,
    selectedTokenDetail?.info.symbol,
    selectedTokenDetail?.balanceParsed,
  ]);

  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.addressInput,
        sceneUrl: '',
      }}
      enabledNum={[0]}
      availableNetworksMap={{
        0: {
          networkIds: [selectedNetworkId ?? ''],
          defaultNetworkId: selectedNetworkId,
        },
      }}
    >
      <Form.Field
        name="senderAddresses"
        label="Sending Address(es)"
        description={renderSenderAddressesDescription()}
        rules={{
          validate: handleValidateAddresses,
        }}
      >
        <LineNumberedTextArea
          singleLine
          showAddressBadges
          addressBadges={addressBadges}
          showPaste
          showAccountSelector
          placeholder="Enter address"
          showLineNumbers={false}
          accountSelector={{
            num: 0,
            clearNotMatch: true,
          }}
          networkId={selectedNetworkId}
          accountId={selectedAccountId}
          indexedAccountId={selectedIndexedAccountId}
        />
      </Form.Field>
    </AccountSelectorProviderMirror>
  );
}

export default SenderAddressesInput;
