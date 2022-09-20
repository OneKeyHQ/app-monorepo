import { useMemo } from 'react';

import { orderBy } from 'lodash';

import { IWallet } from '@onekeyhq/engine/src/types';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';

import { useRuntime } from '../../../hooks/redux';

import type { IWalletDataBase } from '../WalletSelectorChildren/List';

export enum EWalletDataSectionType {
  hd = 'hd',
  hw = 'hw',
  other = 'other',
}
export type IWalletDataSection = {
  type: EWalletDataSectionType;
  data: IWalletDataBase[];
};

export function useWalletSelectorSectionData(): IWalletDataSection[] {
  // TODO rename \ remove \ change avatar \ deviceStatus
  const { wallets } = useRuntime();

  const data = useMemo(() => {
    const hdData: IWalletDataBase[] = [];
    const hwData: IWalletDataBase[] = [];
    const otherData: IWalletDataBase[] = []; // TODO sort by type
    const hwWalletsMap: Partial<{ [deviceId: string]: IWallet[] }> = {};

    wallets.forEach((wallet) => {
      // hd wallet
      if (wallet.type === WALLET_TYPE_HD) {
        hdData.push({
          wallet,
        });
      }
      // imported\watching\external wallet
      if (
        [
          WALLET_TYPE_IMPORTED,
          WALLET_TYPE_WATCHING,
          WALLET_TYPE_EXTERNAL,
        ].includes(wallet.type)
      ) {
        otherData.push({
          wallet,
          isSingleton: true,
        });
      }
      // hw wallet
      if (wallet.type === WALLET_TYPE_HW && wallet.associatedDevice) {
        const deviceId = wallet.associatedDevice || '';
        if (!hwWalletsMap[deviceId]) {
          hwWalletsMap[deviceId] = [];
        }
        hwWalletsMap[deviceId]?.push(wallet);
      }
    });

    // rebuild hw wallet with hidden grouped
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.entries(hwWalletsMap).forEach(([deviceId, hwWallets]) => {
      // eslint-disable-next-line no-param-reassign
      hwWallets = hwWallets || [];
      const normalWallet = hwWallets.find((w) => !w.passphraseState);
      // TODO sort by
      const hiddenWallets = orderBy(
        hwWallets.filter((w) => w.passphraseState),
        ['name'],
        ['asc'],
      );
      if (normalWallet || hiddenWallets.length) {
        hwData.push({
          wallet: normalWallet,
          hiddenWallets,
        });
      }
    });

    return [
      {
        type: EWalletDataSectionType.hd,
        data: hdData,
        // data: [],
      },
      {
        type: EWalletDataSectionType.hw,
        data: hwData,
        // data: [],
      },
      { type: EWalletDataSectionType.other, data: otherData },
    ];
  }, [wallets]);
  return data;
}
