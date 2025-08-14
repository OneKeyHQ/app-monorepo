import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useAllTokenListAtom,
  useAllTokenListMapAtom,
  useTokenListStateAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { useAllNetworkCopyAddressHandler } from '../../../WalletAddress/hooks/useAllNetworkCopyAddressHandler';

export function WalletActionCopy({ onClose }: { onClose: () => void }) {
  const { activeAccount } = useActiveAccount({ num: 0 });

  const {
    network,
    account,
    wallet,
    vaultSettings,
    indexedAccount,
    deriveInfoItems,
  } = activeAccount;

  const intl = useIntl();

  const { copyText } = useClipboard();

  const { isAllNetworkEnabled, handleAllNetworkCopyAddress } =
    useAllNetworkCopyAddressHandler({
      activeAccount,
    });

  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const [allTokens] = useAllTokenListAtom();
  const [map] = useAllTokenListMapAtom();
  const [tokenListState] = useTokenListStateAtom();

  const { handleOnReceive } = useReceiveToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    indexedAccountId: indexedAccount?.id ?? '',
    tokens: {
      data: allTokens.tokens,
      keys: allTokens.keys,
      map,
    },
    tokenListState,
    isMultipleDerive: deriveInfoItems.length > 1,
  });

  const handleCopyAddress = useCallback(async () => {
    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: wallet?.id ?? '',
      })
    ) {
      return;
    }

    defaultLogger.wallet.walletActions.actionCopyAddress({
      walletType: wallet?.type ?? '',
      networkId: network?.id ?? '',
      source: 'homePage',
      isSoftwareWalletOnlyUser,
    });
    if (isAllNetworkEnabled) {
      void handleAllNetworkCopyAddress();
    } else if (accountUtils.isHwWallet({ walletId: wallet?.id ?? '' })) {
      handleOnReceive();
    } else {
      copyText(account?.address || '');
    }
    onClose();
  }, [
    wallet?.id,
    wallet?.type,
    network?.id,
    isSoftwareWalletOnlyUser,
    isAllNetworkEnabled,
    onClose,
    handleAllNetworkCopyAddress,
    handleOnReceive,
    copyText,
    account?.address,
  ]);

  if (
    !network?.isAllNetworks &&
    !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
    vaultSettings?.mergeDeriveAssetsEnabled
  ) {
    return (
      <AddressTypeSelector
        walletId={wallet?.id ?? ''}
        networkId={network?.id ?? ''}
        indexedAccountId={indexedAccount?.id ?? ''}
        renderSelectorTrigger={
          <ActionList.Item
            trackID="wallet-copy"
            icon="Copy3Outline"
            label={intl.formatMessage({
              id: ETranslations.global_copy_address,
            })}
            onClose={() => {}}
            onPress={() => {}}
          />
        }
        tokenMap={map}
        onSelect={async ({
          account: a,
        }: {
          account: INetworkAccount | undefined;
        }) => {
          copyText(a?.address || '');
          onClose();
        }}
      />
    );
  }

  return (
    <ActionList.Item
      trackID="wallet-copy"
      icon="Copy3Outline"
      label={intl.formatMessage({ id: ETranslations.global_copy_address })}
      onClose={() => {}}
      onPress={handleCopyAddress}
    />
  );
}
