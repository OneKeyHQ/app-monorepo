import type { IV4DecodedTx } from './v4typesTx';

// History ----------------------------------------------
type IV4SendConfirmActionType = 'speedUp' | 'cancel';

export type IV4HistoryTx = {
  id: string; // historyId

  isLocalCreated?: boolean;

  replacedPrevId?: string; // cancel speedUp replacedId
  replacedNextId?: string;
  replacedType?: IV4SendConfirmActionType; // cancel speedUp

  decodedTx: IV4DecodedTx;
};
