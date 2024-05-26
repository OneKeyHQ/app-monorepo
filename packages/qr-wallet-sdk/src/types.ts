import {
  CryptoHDKey as AirGapCryptoHDKeyEvm,
  EthSignRequest as AirGapEthSignRequestEvm,
  DataType as EAirGapDataTypeEvm,
} from '@keystonehq/bc-ur-registry-eth';
import { ExtendedRegistryTypes as AirGapRegistryTypesEvm } from '@keystonehq/bc-ur-registry-eth/src/RegistryType';
import { URType as EAirGapURType } from '@keystonehq/keystone-sdk';

import type {
  Account,
  EthSignRequestProps,
  EthSignature,
  MultiAccounts,
} from '@keystonehq/keystone-sdk';

export { AccountNote as EAirGapAccountNoteEvm } from '@keystonehq/keystone-sdk';

export type IAirGapAccount = Account;
export type IAirGapMultiAccounts = MultiAccounts;

export type IAirGapSignatureEvm = EthSignature;
export type IAirGapSignature = IAirGapSignatureEvm;

export type IAirGapGenerateSignRequestParamsEvm = EthSignRequestProps;
export type IAirGapGenerateSignRequestParams =
  IAirGapGenerateSignRequestParamsEvm;

export {
  AirGapCryptoHDKeyEvm,
  AirGapEthSignRequestEvm,
  AirGapRegistryTypesEvm,
  EAirGapDataTypeEvm,
  EAirGapURType,
};
