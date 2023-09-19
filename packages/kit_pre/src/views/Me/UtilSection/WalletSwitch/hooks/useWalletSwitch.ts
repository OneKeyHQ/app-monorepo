import { useEffect, useMemo } from 'react';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../../hooks';
import { CWalletSwitchDefaultConfig } from '../config';

import type { WalletGroup } from '..';

export const useWalletSwitch = () => {
  const walletSwitchData = useAppSelector((s) => s.settings.walletSwitchData);
  useEffect(() => {
    if (
      !walletSwitchData ||
      Object.keys(walletSwitchData).length !==
        Object.keys(CWalletSwitchDefaultConfig).length
    ) {
      backgroundApiProxy.serviceSetting.setWalletSwitchConfig(
        CWalletSwitchDefaultConfig,
      );
    }
  }, [walletSwitchData]);
  const walletSwitchSectionData = useMemo(() => {
    if (walletSwitchData) {
      let resData: WalletGroup[] = [];
      Object.keys(walletSwitchData).forEach((walletId) => {
        const networkId = walletId.split('-')[0];
        const preNetworkSection = resData.find(
          (item) => item.title === networkId,
        );
        if (preNetworkSection) {
          preNetworkSection.data.push(walletId);
        } else {
          resData = [...resData, { title: networkId, data: [walletId] }];
        }
      });
      return resData;
    }
    return [];
  }, [walletSwitchData]);
  return { walletSwitchSectionData };
};

export const useWalletSwitchConfig = ({ walletId }: { walletId: string }) => {
  const walletSwitchData = useAppSelector((s) => s.settings.walletSwitchData);
  return useMemo(
    () => walletSwitchData?.[walletId],
    [walletId, walletSwitchData],
  );
};
