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
  SolSignRequestProps,
  SolSignature,
} from '@keystonehq/keystone-sdk';

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
export type IAirGapGenerateSignRequestParamsSol = SolSignRequestProps;
export type IAirGapGenerateSignRequestParams =
  | IAirGapGenerateSignRequestParamsEvm
  | IAirGapGenerateSignRequestParamsBtc
  | IAirGapGenerateSignRequestParamsSol;

export {
  AirGapCryptoHDKeyEvm,
  AirGapEthSignRequestEvm,
  AirGapRegistryTypesEvm,
  EAirGapDataTypeEvm,
  EAirGapURType,
};
