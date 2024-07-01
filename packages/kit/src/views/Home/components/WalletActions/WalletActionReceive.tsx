import { useMemo } from 'react';

import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';

import { RawActions } from './RawActions';

function WalletActionReceive() {
  const {
    activeAccount: { network, account, wallet, deriveInfo, deriveType },
  } = useActiveAccount({ num: 0 });

  const isReceiveDisabled = useMemo(() => {
    if (wallet?.type === WALLET_TYPE_WATCHING) {
      return true;
    }
    return false;
  }, [wallet?.type]);

  const { handleOnReceive } = useReceiveToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveInfo,
    deriveType,
  });

  return (
    <RawActions.Receive
      disabled={isReceiveDisabled}
      onPress={handleOnReceive}
    />
  );
}

export { WalletActionReceive };
