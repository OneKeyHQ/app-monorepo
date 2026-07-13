import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';
import type { ISignatureConfirmDisplay } from '@onekeyhq/shared/types/signatureConfirm';

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
