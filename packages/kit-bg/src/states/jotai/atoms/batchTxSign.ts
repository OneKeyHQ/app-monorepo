import type { IBatchTxSignProgress } from '@onekeyhq/shared/types/batchTxSign';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

// Background-owned authoritative progress for the in-flight batch PSBT sign
// session. The UI (extension popup can die at any moment) never holds the
// source of truth — it only mirrors this atom.
export const { target: batchTxSignAtom, use: useBatchTxSignAtom } = globalAtom<
  IBatchTxSignProgress | undefined
>({
  name: EAtomNames.batchTxSignAtom,
  initialValue: undefined,
});
