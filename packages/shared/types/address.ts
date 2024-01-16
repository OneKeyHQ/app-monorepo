import type { EAddressEncodings } from '@onekeyhq/core/src/types';

export type IAddressValidation = {
  isValid: boolean;
  normalizedAddress?: string;
  displayAddress?: string;
  encoding?: EAddressEncodings;
};

export type IFetchAddressDetailsParams = {
  networkId: string;
  accountAddress: string;
  xpub?: string;
  withUTXOList?: boolean;
  withNetWorth?: boolean;
  withValidate?: boolean;
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
