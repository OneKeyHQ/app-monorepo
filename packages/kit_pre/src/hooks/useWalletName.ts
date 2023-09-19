import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IWallet } from '@onekeyhq/engine/src/types';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';

import type { IntlShape } from 'react-intl';

function getWalletName({
  wallet,
  intl,
}: {
  intl: IntlShape;
  wallet: IWallet | undefined | null;
}) {
  const type = wallet?.type;
  if (type === WALLET_TYPE_IMPORTED) {
    return intl.formatMessage({ id: 'wallet__imported_accounts' });
  }
  if (type === WALLET_TYPE_WATCHING) {
    return intl.formatMessage({ id: 'wallet__watched_accounts' });
  }
  if (type === WALLET_TYPE_EXTERNAL) {
    return intl.formatMessage({ id: 'content__external_account' });
  }
  return wallet?.name;
}

function useWalletName({ wallet }: { wallet: IWallet | undefined | null }) {
  const intl = useIntl();
  const name = useMemo(
    () =>
      getWalletName({
        intl,
        wallet,
      }),
    [intl, wallet],
  );
  return name;
}

export { useWalletName, getWalletName };
