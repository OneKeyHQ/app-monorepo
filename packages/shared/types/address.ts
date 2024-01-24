import type { EAddressEncodings } from '@onekeyhq/core/src/types';

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

export type IFetchAddressDetailsParams = {
  networkId: string;
  accountAddress: string;
  xpub?: string;
  withUTXOList?: boolean;
  withNetWorth?: boolean;
};

export type IFetchAddressDetailsResp = {
  address: string;
  balance?: string;
  txCount?: number;
  labels?: [];
  balanceParsed?: string;
  nonce?: number;
  isContract?: boolean;
  netWorth?: string;
};
export type IXpubValidation = {
  isValid: boolean;
};
