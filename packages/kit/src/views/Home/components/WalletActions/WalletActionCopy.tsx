import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, useClipboard } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCopyAddressWithDeriveType } from '@onekeyhq/kit/src/hooks/useCopyAccountAddress';
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
  const copyAddressWithDeriveType = useCopyAddressWithDeriveType();

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
    } else if (
      !network?.isAllNetworks &&
      !accountUtils.isOthersWallet({ walletId: wallet?.id ?? '' }) &&
      vaultSettings?.mergeDeriveAssetsEnabled
    ) {
      const defaultDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: network?.id ?? '',
        });

      const { accounts } =
        await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts({
          indexedAccountIds: [indexedAccount?.id ?? ''],
          networkId: network?.id ?? '',
          deriveType: defaultDeriveType,
        });

      copyAddressWithDeriveType({
        address: accounts?.[0]?.address || '',
        deriveInfo: deriveInfoItems.find(
          (item) => item.value === defaultDeriveType,
        )?.item,
        networkName: network?.shortname,
      });
    } else {
      copyText(account?.address || '');
    }
    onClose();
  }, [
    wallet?.id,
    wallet?.type,
    network?.id,
    network?.isAllNetworks,
    network?.shortname,
    isSoftwareWalletOnlyUser,
    isAllNetworkEnabled,
    vaultSettings?.mergeDeriveAssetsEnabled,
    onClose,
    handleAllNetworkCopyAddress,
    handleOnReceive,
    indexedAccount?.id,
    copyAddressWithDeriveType,
    deriveInfoItems,
    copyText,
    account?.address,
  ]);

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
