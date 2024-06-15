import type { EAddressEncodings } from '@onekeyhq/core/src/types';
import type {
  IAccountDeriveInfo,
  IUtxoInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';

import type { IInvoiceDecodedResponse, ILNURLDetails } from './lightning';

// TODO dbAddress, baseAddress, displayAddress, utxoAddress, normalizedAddress
export type IAddressValidation = {
  isValid: boolean;
  normalizedAddress: string; // lowercase address saved to db in EVM
  displayAddress: string; // checksum address in EVM
  encoding?: EAddressEncodings;
  lnurlDetails?: ILNURLDetails;
  decodedInvoice?: IInvoiceDecodedResponse;
  // baseAddress
  // fetchBalanceAddress
  // address of sub networkId
};

export type IFetchAccountDetailsParams = {
  networkId: string;
  accountAddress: string;
  xpub?: string;
  cardanoPubKey?: string;
  withUTXOList?: boolean;
  withNetWorth?: boolean;
  withBalance?: boolean;
  withValidate?: boolean;
  withNonce?: boolean;
  withCheckInscription?: boolean;
  withFrozenBalance?: boolean;
  withTronAccountResources?: boolean;
};

export type IFetchAccountDetailsResp = {
  address: string;
  balance?: string;
  txCount?: number;
  labels?: [];
  balanceParsed?: string;
  nonce?: number;
  accountNumber?: number;
  isContract?: boolean;
  netWorth?: string;
  utxoList?: IUtxoInfo[];
  frozenUtxoList?: IUtxoInfo[];
  validateInfo?: {
    isValid: boolean;
    addressType: string;
  };
  frozenBalance?: string;
  frozenBalanceParsed?: string;
  totalBalance?: string;
  totalBalanceParsed?: string;
};

export type IValidateAddressResp = {
  isValid: boolean;
  addressType?: string;
};

export type IXpubValidation = {
  isValid: boolean;
};

export type IXprvtValidation = {
  isValid: boolean;
};

export type IPrivateKeyValidation = {
  isValid: boolean;
};

export type IGeneralInputValidation = {
  isValid: boolean;
  addressResult?: IAddressValidation;
  xpubResult?: IXpubValidation;
  xprvtResult?: IXprvtValidation;
  privateKeyResult?: IPrivateKeyValidation;
  deriveInfoItems?: IAccountDeriveInfo[];
};

export type INetworkAccountAddressDetail = {
  isValid: boolean;
  networkId: string;
  address: string; // real address at certain subnetwork, alias for displayAddress
  baseAddress: string; // base address shared with all subnetworks
  normalizedAddress: string; // lowercase address saved to db in EVM
  displayAddress: string; // checksum address in EVM
  allowEmptyAddress: boolean; // allow empty address, like lightning network
};

export type IAddressInteractionStatus =
  | 'interacted'
  | 'not-interacted'
  | 'unknown';

export type IAddressValidateStatus =
  | 'valid'
  | 'invalid'
  | 'unknown'
  | 'prohibit-send-to-self';

export type IQueryCheckAddressArgs = {
  networkId: string;
  address: string;
  accountId?: string;
  enableNameResolve?: boolean;
  enableAddressBook?: boolean;
  enableWalletName?: boolean;
  enableAddressInteractionStatus?: boolean;
  enableVerifySendFundToSelf?: boolean;
};
