import { useMemo } from 'react';

import { isPassphraseWallet } from '@onekeyhq/shared/src/engine/engineUtils';

import { useAppSelector } from '../../../hooks';

import type { IWalletDataBase } from '../WalletSelectorChildren/List';

function useIsPassphraseMode(item: IWalletDataBase) {
  const passphraseOpenedList = useAppSelector(
    (state) => state.hardware.passphraseOpened,
  );
  const isPassphraseMode = useMemo(() => {
    const deviceId = item?.wallet?.associatedDevice || '';
    if (passphraseOpenedList.find((v) => v && v === deviceId)) {
      return true;
    }
    if (item?.hiddenWallets?.find((w) => isPassphraseWallet(w))) {
      return true;
    }
    return false;
  }, [
    passphraseOpenedList,
    item?.hiddenWallets,
    item?.wallet?.associatedDevice,
  ]);
  return isPassphraseMode;
}

export { useIsPassphraseMode };
