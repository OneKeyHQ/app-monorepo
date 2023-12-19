import type { IDecodedTx } from '@onekeyhq/shared/types/tx';
import { EDecodedTxDirection } from '@onekeyhq/shared/types/tx';

export function buildTxActionDirection({
  from,
  to,
  accountAddress,
}: {
  from?: string;
  to: string;
  accountAddress: string;
}) {
  const fixedFrom = from?.toLowerCase() ?? '';
  const fixedTo = to.toLowerCase();
  const fixedAccountAddress = accountAddress.toLowerCase();
  if (fixedFrom === fixedTo && fixedFrom === fixedAccountAddress) {
    return EDecodedTxDirection.SELF;
  }
  // out first for internal send
  if (fixedFrom && fixedFrom === fixedAccountAddress) {
    return EDecodedTxDirection.OUT;
  }
  if (fixedTo && fixedTo === fixedAccountAddress) {
    return EDecodedTxDirection.IN;
  }
  return EDecodedTxDirection.OTHER;
}

export function getDisplayedActions({ decodedTx }: { decodedTx: IDecodedTx }) {
  const { outputActions, actions } = decodedTx;
  return (
    (outputActions && outputActions.length ? outputActions : actions) || []
  );
}
