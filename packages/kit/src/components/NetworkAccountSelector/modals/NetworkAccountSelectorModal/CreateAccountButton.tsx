import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { IconButton } from '@onekeyhq/components';
import AccountSelectorWalletMenu from '@onekeyhq/kit/src/views/Overlay/Accounts/AccountSelectorWalletMenu';
import { isExternalWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WALLET_CONNECT_NEW_CONNECTION_BUTTON_LOADING } from '../../../WalletConnect/walletConnectConsts';
import { InitWalletServicesData } from '../../../WalletConnect/WalletConnectQrcodeModal';
import { useCreateAccountInWallet } from '../../hooks/useCreateAccountInWallet';

export function CreateAccountButton({
  walletId,
  networkId,
  isLoading,
}: {
  walletId: string;
  networkId: string | undefined;
  isLoading?: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    createAccount,
    isCreateAccountSupported,
    showCreateAccountMenu,
    isAddressDerivationSupported,
  } = useCreateAccountInWallet({
    networkId,
    walletId,
    isFromAccountSelector: true,
  });
  const isExternal = useMemo(() => {
    if (!walletId) {
      return false;
    }
    return isExternalWallet({ walletId });
  }, [walletId]);

  // const isDisabled = selectedNetworkId === AllNetwork
  // if (selectedNetworkId === AllNetwork) return null;

  const initWalletServiceRef = useRef<JSX.Element | undefined>();

  useEffect(() => {
    // iOS should open walletServices list Modal
    if (platformEnv.isNativeIOS) {
      return;
    }
    if (initWalletServiceRef.current) {
      return;
    }
    if (isExternal) {
      initWalletServiceRef.current = <InitWalletServicesData />;
    }
  }, [isExternal]);

  const [isCreatLoading, setIsCreatLoading] = useState(false);
  const timerRef = useRef<any>();

  const buttonIsLoading = isLoading || isCreatLoading;

  const buttonOnPress = useCallback(async () => {
    if (!walletId || isLoading) return;
    try {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(
        () => setIsCreatLoading(false),
        WALLET_CONNECT_NEW_CONNECTION_BUTTON_LOADING,
      );
      setIsCreatLoading(true);

      await createAccount();
    } finally {
      clearTimeout(timerRef.current);
      setIsCreatLoading(false);
    }
  }, [createAccount, isLoading, walletId]);

  return (
    <>
      {/* TODO move to parent */}
      {initWalletServiceRef.current}

      {isAddressDerivationSupported &&
        (showCreateAccountMenu ? (
          <AccountSelectorWalletMenu networkId={networkId} walletId={walletId}>
            <IconButton
              testID="NetworkAccountSelectorModal-CreateAccountButton"
              isLoading={buttonIsLoading}
              type="plain"
              name={isCreateAccountSupported ? 'PlusCircleOutline' : 'BanMini'}
              circle
              hitSlop={8}
            />
          </AccountSelectorWalletMenu>
        ) : (
          <IconButton
            testID="NetworkAccountSelectorModal-CreateAccountButton"
            isLoading={buttonIsLoading}
            onPress={buttonOnPress}
            type="plain"
            name={isCreateAccountSupported ? 'PlusCircleOutline' : 'BanMini'}
            circle
            hitSlop={8}
          />
        ))}
    </>
  );
}
