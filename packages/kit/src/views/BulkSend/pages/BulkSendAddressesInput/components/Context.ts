import { createContext, useContext } from 'react';

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
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
  });

export const useBulkSendAddressesInputContext = () =>
  useContext(BulkSendAddressesInputContext);
