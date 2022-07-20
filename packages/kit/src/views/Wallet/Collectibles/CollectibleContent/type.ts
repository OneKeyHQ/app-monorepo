import { MoralisNFT } from '@onekeyhq/engine/src/types/moralis';

export type NFTProps = {
  loading?: boolean;
  url?: string;
  asset: MoralisNFT;
  width?: number;
  height?: number;
};
