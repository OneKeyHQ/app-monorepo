import type { EAddressEncodings } from '@onekeyhq/core/src/types';
import type { IUtxoInfo } from '@onekeyhq/kit-bg/src/vaults/types';

// TODO dbAddress, baseAddress, displayAddress, utxoAddress, normalizedAddress
export type IAddressValidation = {
  isValid: boolean;
  normalizedAddress: string; // lowercase address saved to db in EVM
  displayAddress: string; // checksum address in EVM
  encoding?: EAddressEncodings;
  // baseAddress
  // fetchBalanceAddress
  // address of sub networkId
};

export type IFetchAccountDetailsParams = {
  networkId: string;
  accountAddress: string;
  xpub?: string;
  withUTXOList?: boolean;
  withNetWorth?: boolean;
  withBalance?: boolean;
  withValidate?: boolean;
};

export type IFetchAccountDetailsResp = {
  address: string;
  balance?: string;
  txCount?: number;
  labels?: [];
  balanceParsed?: string;
  nonce?: number;
  isContract?: boolean;
  netWorth?: string;
  utxoList?: IUtxoInfo[];
  validateInfo?: {
    isValid: boolean;
    addressType: string;
  };
};
export type IXpubValidation = {
  isValid: boolean;
};

export type INetworkAccountAddressDetail = {
  isValid: boolean;
  networkId: string;
  address: string; // real address at certain subnetwork, alias for displayAddress
  baseAddress: string; // base address shared with all subnetworks
  normalizedAddress: string; // lowercase address saved to db in EVM
  displayAddress: string; // checksum address in EVM
};
