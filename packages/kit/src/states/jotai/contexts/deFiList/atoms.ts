import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextDeFiList,
  withProvider: withDeFiListProvider,
  contextAtom,
  contextAtomMethod,
} = createJotaiContext();
export {
  ProviderJotaiContextDeFiList,
  contextAtomMethod,
  withDeFiListProvider,
};

export const { atom: deFiListOverviewAtom, use: useDeFiListOverviewAtom } =
  contextAtom<{
    totalValue: string;
    totalDebt: string;
    netWorth: string;
    chains: string[];
    protocolCount: number;
    positionCount: number;
  }>({
    totalValue: '0',
    totalDebt: '0',
    netWorth: '0',
    chains: [],
    protocolCount: 0,
    positionCount: 0,
  });

export const { atom: deFiListProtocolsAtom, use: useDeFiListProtocolsAtom } =
  contextAtom<{
    protocols: IDeFiProtocol[];
  }>({
    protocols: [],
  });

export const {
  atom: deFiListProtocolMapAtom,
  use: useDeFiListProtocolMapAtom,
} = contextAtom<{
  protocolMap: Record<string, IProtocolSummary>;
}>({
  protocolMap: {},
});

export const { atom: deFiListStateAtom, use: useDeFiListStateAtom } =
  contextAtom<{
    isRefreshing: boolean;
    initialized: boolean;
  }>({
    isRefreshing: true,
    initialized: false,
  });
