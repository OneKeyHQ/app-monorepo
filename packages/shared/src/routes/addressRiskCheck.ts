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
  // The page shows the loading and runs the check itself.
  [EModalAddressRiskCheckRoutes.AddressRiskCheckResult]:
    | {
        checkRequest: {
          networkId: string;
          address: string;
          entryPoint: 'sendAddressInput';
        };
        showMoreAnalysis: false;
        onContinue: () => void | Promise<void>;
      }
    | {
        checkRequest: {
          networkId: string;
          address: string;
          entryPoint: 'inputManual' | 'inputRecentList' | 'historyList';
        };
        showMoreAnalysis: true;
        onContinue?: never;
      };
  [EModalAddressRiskCheckRoutes.AddressRiskCheckHistory]: undefined;
};
