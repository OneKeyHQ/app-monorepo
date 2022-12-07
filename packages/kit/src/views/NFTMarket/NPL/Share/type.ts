import { BigNumber } from 'bignumber.js';

import { Network } from '@onekeyhq/engine/src/types/network';
import { NFTNPL } from '@onekeyhq/engine/src/types/nft';

export enum ShareNFTNPLRoutes {
  ShareNFTNPLModal = 'ShareNFTNPLModal',
}

export type ShareNFTNPLRoutesParams = {
  [ShareNFTNPLRoutes.ShareNFTNPLModal]: {
    assets: NFTNPL[];
    win?: number;
    lose?: number;
    totalProfit?: BigNumber;
    network: Network;
    name?: string;
    address: string;
    startTime: number;
    endTime: number;
  };
};
