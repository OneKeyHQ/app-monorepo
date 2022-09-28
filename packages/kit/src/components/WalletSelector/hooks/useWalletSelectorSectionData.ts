import { useEffect, useRef, useState } from 'react';

import { debounce, orderBy } from 'lodash';
import { InteractionManager } from 'react-native';

import { IWallet } from '@onekeyhq/engine/src/types';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/engine/src/types/wallet';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { useRuntime } from '../../../hooks/redux';

import { useWalletSelectorStatus } from './useWalletSelectorStatus';

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

const buildData = debounce(
  ({
    wallets,
    setData,
  }: {
    wallets: IWallet[];
    setData: React.Dispatch<
      React.SetStateAction<
        { type: EWalletDataSectionType; data: IWalletDataBase[] }[]
      >
    >;
  }) => {
    const hdData: IWalletDataBase[] = [];
    const hwData: IWalletDataBase[] = [];
    const otherData: IWalletDataBase[] = [];
    const hwWalletsMap: Partial<{ [deviceId: string]: IWallet[] }> = {};

    wallets.forEach((wallet, index) => {
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
          isLastItem: index === wallets.length - 1,
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

    debugLogger.accountSelector.info('rebuild WalletSelector walletList data');
    const d = [
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
    setData(d);
  },
  150,
  {
    leading: false,
    trailing: true,
  },
);

export function useWalletSelectorSectionData(): IWalletDataSection[] {
  const { wallets } = useRuntime();
  const [data, setData] = useState<
    { type: EWalletDataSectionType; data: IWalletDataBase[] }[]
  >([]);

  const { visible } = useWalletSelectorStatus();
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    if (visibleRef.current) {
      buildData({ wallets, setData });
    } else {
      InteractionManager.runAfterInteractions(() => {
        buildData({ wallets, setData });
      });
    }
  }, [wallets]);

  return data;
}
