import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useCreateAccountInWallet } from '../../../components/NetworkAccountSelector/hooks/useCreateAccountInWallet';
import BaseMenu from '../BaseMenu';

import type { IBaseMenuOptions, IMenu } from '../BaseMenu';

const AccountSelectorWalletMenu: FC<
  IMenu & { walletId: string; networkId: string | undefined }
> = (props) => {
  const { walletId, networkId } = props;
  const { createAccount } = useCreateAccountInWallet({
    networkId,
    walletId,
    isFromAccountSelector: true,
  });
  const onPressCreateAccount = useCallback(async () => {
    if (!walletId) return;
    await createAccount();
  }, [walletId, createAccount]);

  const options = useMemo<IBaseMenuOptions>(
    () => [
      {
        id: 'action__add_account',
        onPress: onPressCreateAccount,
        icon: 'PlusMini',
      },
      {
        id: 'action__add_account',
        onPress: () => {},
        icon: 'SquaresPlusMini',
      },
    ],
    [onPressCreateAccount],
  );

  return <BaseMenu options={options} {...props} />;
};

export default AccountSelectorWalletMenu;
