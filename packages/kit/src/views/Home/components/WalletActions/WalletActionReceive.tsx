import { useReceiveToken } from '@onekeyhq/kit/src/hooks/useReceiveToken';
import type {
  IAccountDeriveInfo,
  IAccountDeriveTypes,
} from '@onekeyhq/kit-bg/src/vaults/types';

import { RawActions } from './RawActions';

type IProps = {
  networkId: string | undefined;
  accountId: string | undefined;
  walletId: string | undefined;
  deriveInfo: IAccountDeriveInfo | undefined;
  deriveType: IAccountDeriveTypes;
};

function WalletActionReceive(props: IProps) {
  const { accountId, networkId, walletId, deriveInfo, deriveType } = props;
  const { handleOnReceive } = useReceiveToken({
    accountId: accountId ?? '',
    networkId: networkId ?? '',
    walletId: walletId ?? '',
    deriveInfo,
    deriveType,
  });

  return <RawActions.Receive onPress={handleOnReceive} />;
}

export { WalletActionReceive };
