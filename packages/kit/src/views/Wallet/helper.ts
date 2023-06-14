import type { Network } from '@onekeyhq/engine/src/types/network';

import { WalletHomeTabEnum } from './type';

export const generateHomeTabIndexMap = (network?: Network | null) => {
  if (network?.settings.hiddenNFTTab && network?.settings.hiddenToolTab) {
    return {
      [WalletHomeTabEnum.Tokens]: 0,
      [WalletHomeTabEnum.History]: 1,
    };
  }
  return {
    [WalletHomeTabEnum.Tokens]: 0,
    [WalletHomeTabEnum.Collectibles]: 1,
    [WalletHomeTabEnum.History]: 2,
    [WalletHomeTabEnum.Tools]: 3,
  };
};

export const getHomeTabNameByIndex = ({
  network,
  index,
}: {
  network?: Network | null;
  index: number;
}) => {
  if (network?.settings.hiddenNFTTab && network?.settings.hiddenToolTab) {
    return index === 0 ? WalletHomeTabEnum.Tokens : WalletHomeTabEnum.History;
  }
  return [
    WalletHomeTabEnum.Tokens,
    WalletHomeTabEnum.Collectibles,
    WalletHomeTabEnum.History,
    WalletHomeTabEnum.Tools,
  ][index];
};
