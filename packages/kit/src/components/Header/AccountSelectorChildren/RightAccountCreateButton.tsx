import type { FC } from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Wallet } from '@onekeyhq/engine/src/types/wallet';
import { isExternalWallet } from '@onekeyhq/shared/src/engine/engineUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useCreateAccountInWallet } from '../../NetworkAccountSelector/hooks/useCreateAccountInWallet';
import { WALLET_CONNECT_NEW_CONNECTION_BUTTON_LOADING } from '../../WalletConnect/walletConnectConsts';
import { InitWalletServicesData } from '../../WalletConnect/WalletConnectQrcodeModal';

type Props = {
  activeWallet: null | Wallet | undefined;
  isLoading: boolean;
  selectedNetworkId: string | undefined;
  activeNetwork: null | Network;
};

const RightAccountCreateButton: FC<Props> = ({
  activeWallet,
  isLoading,
  selectedNetworkId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  activeNetwork,
}) => {
  const intl = useIntl();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { createAccount, isCreateAccountSupported } = useCreateAccountInWallet({
    networkId: selectedNetworkId,
    walletId: activeWallet?.id,
  });
  const isExternal = useMemo(() => {
    if (!activeWallet?.id) {
      return false;
    }
    return isExternalWallet({ walletId: activeWallet?.id });
  }, [activeWallet?.id]);

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
  return (
    <>
      {initWalletServiceRef.current}
      <Button
        testID="AccountSelectorChildren-RightAccountCreateButton"
        leftIconName="UserAddMini"
        size="xl"
        isLoading={isLoading || isCreatLoading}
        onPress={async () => {
          if (!activeWallet || isLoading) return;
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
        }}
      >
        {intl.formatMessage({ id: 'action__add_account' })}
      </Button>
    </>
  );
};

export default memo(RightAccountCreateButton);
