import {
  CryptoHDKey as AirGapCryptoHDKeyEvm,
  EthSignRequest as AirGapEthSignRequestEvm,
  DataType as EAirGapDataTypeEvm,
} from '@keystonehq/bc-ur-registry-eth';
import { ExtendedRegistryTypes as AirGapRegistryTypesEvm } from '@keystonehq/bc-ur-registry-eth/src/RegistryType';
import { URType as EAirGapURType } from '@keystonehq/keystone-sdk';

import type {
  Account,
  BtcSignRequestProps,
  BtcSignature,
  EthSignRequestProps,
  EthSignature,
  MultiAccounts,
  SolSignature,
} from '@keystonehq/keystone-sdk';

export enum EAirGapDataTypeSol {
  Unknown = 0,
  Transaction = 1,
  Message = 2,
  Off_Chain_Message_Legacy = 3,
  Off_Chain_Message_Standard = 4,
}

export { AccountNote as EAirGapAccountNoteEvm } from '@keystonehq/keystone-sdk';

export type IAirGapAccount = Account;
export type IAirGapMultiAccounts = MultiAccounts;

export type IAirGapSignatureEvm = EthSignature;
export type IAirGapSignatureBtc = BtcSignature;
export type IAirGapSignatureSol = SolSignature;
export type IAirGapSignature =
  | IAirGapSignatureEvm
  | IAirGapSignatureBtc
  | IAirGapSignatureSol;

export type IAirGapGenerateSignRequestParamsEvm = EthSignRequestProps;
export type IAirGapGenerateSignRequestParamsBtc = BtcSignRequestProps;
export type IAirGapGenerateSignRequestParamsSol = {
  requestId: string;
  signData: string;
  dataType: EAirGapDataTypeSol;
  path: string;
  xfp: string;
  address?: string;
  origin?: string;
};
export type IAirGapGenerateSignRequestParams =
  | IAirGapGenerateSignRequestParamsEvm
  | IAirGapGenerateSignRequestParamsBtc
  | IAirGapGenerateSignRequestParamsSol;

export interface IAirGapSDK {
  normalizeGetMultiAccountsPath(path: string): string;
}

export {
  AirGapCryptoHDKeyEvm,
  AirGapEthSignRequestEvm,
  AirGapRegistryTypesEvm,
  EAirGapDataTypeEvm,
  EAirGapURType,
};
