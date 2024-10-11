import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export function NoAddressWarning({
  accountId,
  networkId,
  indexedAccountId,
  onCreateAddress,
}: {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
  onCreateAddress: () => void;
}) {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);
  const {
    activeAccount: { wallet },
  } = useActiveAccount({ num: 0 });
  const { createAddress } = useAccountSelectorCreateAddress();
  const handleCreateAddress = useCallback(async () => {
    setIsLoading(true);
    try {
      const deriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
      await createAddress({
        num: 0,
        account: {
          walletId: wallet?.id,
          networkId,
          indexedAccountId,
          deriveType: networkUtils.isBTCNetwork(networkId)
            ? 'BIP86'
            : deriveType,
        },
        selectAfterCreate: false,
      });
      onCreateAddress();
    } finally {
      setIsLoading(false);
    }
  }, [wallet, indexedAccountId, networkId, createAddress, onCreateAddress]);

  const { result } = usePromiseResult(async () => {
    const { serviceAccount, serviceNetwork } = backgroundApiProxy;
    let accountName = '';
    try {
      const account = await serviceAccount.getAccount({
        accountId,
        networkId,
      });
      accountName = account.name;
    } catch (e) {
      if (indexedAccountId) {
        const indexedAccount = await serviceAccount.getIndexedAccount({
          id: indexedAccountId,
        });
        accountName = indexedAccount.name;
      }
    }

    const network = await serviceNetwork.getNetwork({ networkId });
    return {
      accountName,
      networkName: network.name,
    };
  }, [accountId, indexedAccountId, networkId]);

  const isOthersAccount = accountUtils.isOthersAccount({ accountId });

  const content = useMemo(() => {
    if (isOthersAccount) {
      return {
        title: intl.formatMessage(
          { id: ETranslations.wallet_unsupported_network_title },
          { network: result?.networkName ?? '' },
        ),
        description: intl.formatMessage({
          id: ETranslations.wallet_unsupported_network_desc,
        }),
      };
    }

    return {
      title: intl.formatMessage({
        id: ETranslations.wallet_no_address,
      }),
      description: intl.formatMessage(
        {
          id: ETranslations.global_private_key_error,
        },
        {
          network: result?.networkName ?? '',
          path: networkUtils.isBTCNetwork(networkId) ? '(Taproot)' : '',
        },
      ),
    };
  }, [result, isOthersAccount, networkId, intl]);

  if (!result) {
    return null;
  }

  if (!accountId && !indexedAccountId) {
    return (
      <Alert
        type="critical"
        title={intl.formatMessage({
          id: ETranslations.swap_page_button_no_connected_wallet,
        })}
      />
    );
  }

  return (
    <Alert
      type="warning"
      title={content.title}
      description={content.description}
      action={
        isOthersAccount
          ? undefined
          : {
              primary: intl.formatMessage({
                id: ETranslations.dapp_connect_create,
              }),
              onPrimaryPress: () => handleCreateAddress(),
              isPrimaryLoading: isLoading,
            }
      }
    />
  );
}
