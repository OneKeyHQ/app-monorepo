import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IAddressInfo } from '@onekeyhq/shared/types/address';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';
import type { IToken } from '@onekeyhq/shared/types/token';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextApprovalList,
  withProvider: withApprovalListProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export {
  ProviderJotaiContextApprovalList,
  contextAtomMethod,
  withApprovalListProvider,
};

export const { atom: approvalListStateAtom, use: useApprovalListStateAtom } =
  contextAtom<{
    isRefreshing: boolean;
    initialized: boolean;
  }>({
    isRefreshing: false,
    initialized: false,
  });

export const { atom: approvalListAtom, use: useApprovalListAtom } =
  contextAtom<{
    approvals: IContractApproval[];
  }>({
    approvals: [],
  });

export const { atom: tokenMapAtom, use: useTokenMapAtom } = contextAtom<{
  tokenMap: Record<
    string,
    {
      price: string;
      price24h: string;
      info: IToken;
    }
  >;
}>({
  tokenMap: {},
});

export const { atom: contractMapAtom, use: useContractMapAtom } = contextAtom<{
  contractMap: Record<string, IAddressInfo>;
}>({
  contractMap: {},
});

export const { atom: selectedTokensAtom, use: useSelectedTokensAtom } =
  contextAtom<{
    selectedTokens: Record<string, boolean>;
  }>({
    selectedTokens: {},
  });

export const { atom: isBulkRevokeModeAtom, use: useIsBulkRevokeModeAtom } =
  contextAtom<boolean>(false);

export const { atom: searchKeyAtom, use: useSearchKeyAtom } =
  contextAtom<string>('');

export const { atom: searchNetworkAtom, use: useSearchNetworkAtom } =
  contextAtom<{
    networkId: string;
  }>({
    networkId: getNetworkIdsMap().onekeyall,
  });
