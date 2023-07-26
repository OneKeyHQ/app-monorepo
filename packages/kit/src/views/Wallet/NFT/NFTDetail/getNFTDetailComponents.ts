import type { INFTAsset } from '@onekeyhq/engine/src/types/nft';
import { NFTAssetType } from '@onekeyhq/engine/src/types/nft';

import { BTCAssetDetailContent } from './Components/BTCAsset/BTCAssetDetailContent';
import { BTCAssetImageContent } from './Components/BTCAsset/BTCAssetImageContent';
import { EVMAssetDetailContent } from './Components/EVMAsset/EVMAssetDetailContent';
import { EVMAssetImageContent } from './Components/EVMAsset/EVMAssetImageContent';
import { SOLAssetDetailContent } from './Components/SOLAsset/SOLAssetDetailContent';
import { SOLAssetImageContent } from './Components/SOLAsset/SOLAssetImageContent';

type Props = {
  asset: INFTAsset;
  isOwner: boolean;
  networkId: string;
  accountId?: string;
};

export type ComponentReturnProps = (params: Props) => JSX.Element | null;

type NFTDetailCompinents = {
  ImageContent: ComponentReturnProps;
  DetailContent: ComponentReturnProps;
};

function getNFTDetailComponents({
  asset,
}: {
  asset: INFTAsset;
}): NFTDetailCompinents {
  switch (asset.type) {
    case NFTAssetType.EVM:
      return {
        ImageContent: EVMAssetImageContent as ComponentReturnProps,
        DetailContent: EVMAssetDetailContent as ComponentReturnProps,
      };
    case NFTAssetType.SOL:
      return {
        ImageContent: SOLAssetImageContent as ComponentReturnProps,
        DetailContent: SOLAssetDetailContent as ComponentReturnProps,
      };
    case NFTAssetType.BTC:
      return {
        ImageContent: BTCAssetImageContent as ComponentReturnProps,
        DetailContent: BTCAssetDetailContent as ComponentReturnProps,
      };
    default:
      return {
        ImageContent: () => null,
        DetailContent: () => null,
      };
  }
}

export { getNFTDetailComponents };
