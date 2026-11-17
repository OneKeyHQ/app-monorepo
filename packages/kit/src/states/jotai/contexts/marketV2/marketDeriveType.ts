import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';

export type IMarketSelectedDeriveType = {
  networkId: string;
  deriveType: IAccountDeriveTypes;
};

export function getSelectedDeriveTypeForNetwork(
  selection: IMarketSelectedDeriveType | undefined,
  networkId: string | undefined,
) {
  return selection && networkId && selection.networkId === networkId
    ? selection.deriveType
    : undefined;
}
