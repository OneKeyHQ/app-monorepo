// cspell:ignore optiga
export interface ITrezorDeviceAuthenticityProof {
  optiga_certificates: string[];
  optiga_signature: string;
  tropic_certificates?: string[];
  tropic_signature?: string;
  mcu_certificates?: string[];
  mcu_signature?: string;
}

export interface IThirdPartyDeviceAuthenticityResult {
  vendor: 'trezor' | 'ledger';
  verified: boolean;
  deviceId?: string;
  serialNumber?: string;
  deviceModel?: string;
  usedDebugKey?: boolean;
  error?: string;
  trezorProof?: {
    challenge: string;
    deviceModel: string;
    proof: ITrezorDeviceAuthenticityProof;
  };
}
