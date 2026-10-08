import { createContext, useContext } from 'react';

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type {
  IBulkSendAddressesInputSeedNetwork,
  IBulkSendAddressesInputSeedSender,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import type { ILineError } from './AddressesInput/LineNumberedTextArea';

export type ITokenDetailsState = {
  initialized: boolean;
  isRefreshing: boolean;
};

export type IResolvedSenderAccount = {
  accountId: string;
  indexedAccountId?: string;
};

export type IBulkSendAddressesFormValues = {
  senderAddresses: string;
  receiverAddresses: string;
};

export type IBulkSendAddressesInputContext = {
  currentWalletId: string | undefined;
  selectedAccountId: string | undefined;
  setSelectedAccountId: (accountId: string | undefined) => void;
  selectedNetworkId: string | undefined;
  setSelectedNetworkId: (networkId: string | undefined) => void;
  selectedToken: IToken | undefined;
  setSelectedToken: (token: IToken | undefined) => void;
  selectedIndexedAccountId: string | undefined;
  setSelectedIndexedAccountId: (indexedAccountId: string | undefined) => void;
  selectedTokenDetail: ({ info: IToken } & ITokenFiat) | undefined;
  setSelectedTokenDetail: (
    tokenDetail: ({ info: IToken } & ITokenFiat) | undefined,
  ) => void;
  tokenDetailsState: ITokenDetailsState;
  setTokenDetailsState: (
    state:
      | ITokenDetailsState
      | ((prev: ITokenDetailsState) => ITokenDetailsState),
  ) => void;
  bulkSendMode: EBulkSendMode;
  setBulkSendMode: (bulkSendMode: EBulkSendMode) => void;
  duplicateAddressCount: number;
  setDuplicateAddressCount: (count: number) => void;
  selectedDeriveType: IAccountDeriveTypes | undefined;
  setSelectedDeriveType: (deriveType: IAccountDeriveTypes | undefined) => void;
  // Per-sender resolved accounts (ManyToOne/ManyToMany)
  resolvedSenderAccountIds: Record<number, IResolvedSenderAccount>;
  setResolvedSenderAccountIds: (
    ids: Record<number, IResolvedSenderAccount>,
  ) => void;
  // Track duplicate sender addresses (ManyToMany only)
  duplicateSenderAddressCount: number;
  setDuplicateSenderAddressCount: (count: number) => void;
  hasUserSelectedAsset: boolean;
  setHasUserSelectedAsset: (value: boolean) => void;
  receiverValidationErrors: ILineError[];
  setReceiverValidationErrors: (errors: ILineError[]) => void;
  // True until the background seed (account / network / token / sender)
  // for the current selection source has been applied. Drives the
  // size-stable loading state and gates the Next button (OK-61587).
  isInitializing: boolean;
  // The selection the page was seeded with; the address effect skips the
  // redundant round trip while the selection still matches it.
  seededAccountId: string | undefined;
  seededNetworkId: string | undefined;
  seededNetwork: IBulkSendAddressesInputSeedNetwork | undefined;
  seededSender: IBulkSendAddressesInputSeedSender | undefined;
  // Set by the sender field once react-hook-form has registered it, so the
  // Next button never trusts `isValid` from a form without fields.
  isSenderFieldMounted: boolean;
  setIsSenderFieldMounted: (value: boolean) => void;
};
export const BulkSendAddressesInputContext =
  createContext<IBulkSendAddressesInputContext>({
    currentWalletId: undefined,
    selectedAccountId: undefined,
    setSelectedAccountId: () => {},
    selectedNetworkId: undefined,
    setSelectedNetworkId: () => {},
    selectedToken: undefined,
    setSelectedToken: () => {},
    selectedIndexedAccountId: undefined,
    setSelectedIndexedAccountId: () => {},
    selectedTokenDetail: undefined,
    setSelectedTokenDetail: () => {},
    tokenDetailsState: {
      initialized: false,
      isRefreshing: false,
    },
    setTokenDetailsState: () => {},
    bulkSendMode: EBulkSendMode.OneToMany,
    setBulkSendMode: () => {},
    duplicateAddressCount: 0,
    setDuplicateAddressCount: () => {},
    selectedDeriveType: undefined,
    setSelectedDeriveType: () => {},
    resolvedSenderAccountIds: {},
    setResolvedSenderAccountIds: () => {},
    duplicateSenderAddressCount: 0,
    setDuplicateSenderAddressCount: () => {},
    hasUserSelectedAsset: false,
    setHasUserSelectedAsset: () => {},
    receiverValidationErrors: [],
    setReceiverValidationErrors: () => {},
    isInitializing: false,
    seededAccountId: undefined,
    seededNetworkId: undefined,
    seededNetwork: undefined,
    seededSender: undefined,
    isSenderFieldMounted: false,
    setIsSenderFieldMounted: () => {},
  });

export const useBulkSendAddressesInputContext = () =>
  useContext(BulkSendAddressesInputContext);
