import BigNumber from 'bignumber.js';
import { unionBy } from 'lodash';

import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import type { IDecodedTxAction } from '@onekeyhq/engine/src/vaults/types';
import type { IBtcUTXO } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';

export function getInscriptionsInActions(actions: IDecodedTxAction[]) {
  const inscriptions: NFTBTCAssetModel[] = [];
  let inscriptionsInSameUtxo: NFTBTCAssetModel[] = [];
  for (const action of actions) {
    if (action.inscriptionInfo) {
      inscriptions.push(action.inscriptionInfo?.asset);
      inscriptionsInSameUtxo = action.inscriptionInfo?.assetsInSameUtxo ?? [];
    }

    if (action.brc20Info) {
      inscriptions.push(action.brc20Info.asset);
      inscriptionsInSameUtxo = action.inscriptionInfo?.assetsInSameUtxo ?? [];
    }
  }
  return {
    inscriptions,
    inscriptionsInSameUtxo,
  };
}

export function getInscriptionsInUtxo({
  utxo,
  inscriptionsInActions,
  inscriptionsInSameUtxo,
  type,
  isListOrderPsbt,
}: {
  utxo: Partial<IBtcUTXO>;
  inscriptionsInActions: NFTBTCAssetModel[];
  inscriptionsInSameUtxo: NFTBTCAssetModel[];
  type: 'inputs' | 'outputs';
  isListOrderPsbt?: boolean;
}) {
  let inscriptions: NFTBTCAssetModel[] = [];
  let restInscriptions = inscriptionsInActions;

  if (utxo.inscriptions) {
    if (type === 'outputs' && isListOrderPsbt) {
      inscriptions = [];
    } else {
      inscriptions = utxo.inscriptions;
    }
  } else if (utxo.txid) {
    inscriptions = inscriptionsInActions.filter(
      (inscription) => inscription.tx_hash === utxo.txid,
    );
    if (inscriptions.length === 0) {
      const result = inscriptionsInActions.find((inscription) =>
        new BigNumber(inscription.output_value_sat).isEqualTo(utxo.value ?? 0),
      );
      if (result) {
        inscriptions.push(result);
        restInscriptions = restInscriptions.filter(
          (inscription) => inscription.inscription_id !== result.inscription_id,
        );
      }
    }
  } else {
    const result = inscriptionsInActions.find((inscription) =>
      new BigNumber(inscription.output_value_sat).isEqualTo(utxo.value ?? 0),
    );
    if (result) {
      inscriptions.push(result);
      restInscriptions = restInscriptions.filter(
        (inscription) => inscription.inscription_id !== result.inscription_id,
      );
    }
  }

  const siblingInscriptions = inscriptionsInSameUtxo.filter((nft) =>
    inscriptions.some(
      (inscription) =>
        nft.inscription_id !== inscription.inscription_id &&
        nft.owner === inscription.owner &&
        nft.output === inscription.output &&
        nft.output_value_sat === inscription.output_value_sat,
    ),
  );

  return {
    inscriptions: [
      ...unionBy(inscriptions, 'inscription_id'),
      ...siblingInscriptions,
    ],
    restInscriptions: unionBy(restInscriptions, 'inscription_id'),
  };
}
