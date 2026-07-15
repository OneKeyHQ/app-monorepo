import {
  EParseTxComponentType,
  EParseTxType,
} from '@onekeyhq/shared/types/signatureConfirm';
import type {
  IParseTransactionResp,
  ISignatureConfirmDisplay,
} from '@onekeyhq/shared/types/signatureConfirm';

// The parse API renders Permit2 revocations natively (type `revokeApproval`),
// so its display is preferred; local components lack server-side metadata
// such as spender dApp tags and would surface raw calldata semantics
// (zero amount, Permit2 contract row) to the user.
export function shouldUseLocalPermit2Display({
  hasPermit2ApproveInfo,
  parsedTx,
}: {
  hasPermit2ApproveInfo: boolean;
  parsedTx: Pick<IParseTransactionResp, 'display' | 'type'> | null;
}) {
  if (!hasPermit2ApproveInfo) {
    return false;
  }
  return !parsedTx?.display || parsedTx.type === EParseTxType.Unknown;
}

export function getPermit2ServerDisplayExtras(
  display?: ISignatureConfirmDisplay | null,
) {
  return {
    simulationComponents:
      display?.components.filter(
        (component) => component.type === EParseTxComponentType.Simulation,
      ) ?? [],
    alerts: display?.alerts ?? [],
  };
}
