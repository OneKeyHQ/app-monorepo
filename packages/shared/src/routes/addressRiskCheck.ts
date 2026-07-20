import type { IAddressRiskCheckResult } from '../../types/addressRiskCheck';

export enum EModalAddressRiskCheckRoutes {
  AddressRiskCheckInput = 'AddressRiskCheckInput',
  AddressRiskCheckResult = 'AddressRiskCheckResult',
  AddressRiskCheckHistory = 'AddressRiskCheckHistory',
}

export type IModalAddressRiskCheckParamList = {
  [EModalAddressRiskCheckRoutes.AddressRiskCheckInput]:
    | {
        // Active network when the modal was opened; pre-selected if supported.
        networkId?: string;
      }
    | undefined;
  [EModalAddressRiskCheckRoutes.AddressRiskCheckResult]: {
    result: IAddressRiskCheckResult;
  };
  [EModalAddressRiskCheckRoutes.AddressRiskCheckHistory]: undefined;
};
