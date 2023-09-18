import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import type { IDecodedTxAction } from '@onekeyhq/engine/src/vaults/types';

export function getInscriptionsInActions(actions: IDecodedTxAction[]) {
  const inscriptions: NFTBTCAssetModel[] = [];
  for (const action of actions) {
    if (action.inscriptionInfo) {
      inscriptions.push(action.inscriptionInfo.asset);
    }

    if (action.brc20Info) {
      inscriptions.push(action.brc20Info.asset);
    }
  }
  return inscriptions;
}
