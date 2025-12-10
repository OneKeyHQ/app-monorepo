import { useRef } from 'react';

import BigNumber from 'bignumber.js';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  deFiListOverviewAtom,
  deFiListProtocolMapAtom,
  deFiListProtocolsAtom,
  deFiListStateAtom,
} from './atoms';

class ContextJotaiActionsDeFiList extends ContextJotaiActionsBase {
  updateDeFiListOverview = contextAtomMethod(
    (
      get,
      set,
      value: {
        overview: {
          totalValue: string;
          totalDebt: string;
          netWorth: string;
          chains: string[];
          protocolCount: number;
          positionCount: number;
        };
        merge?: boolean;
      },
    ) => {
      const overview = get(deFiListOverviewAtom());

      if (value.merge) {
        const newOverview = {
          totalValue: new BigNumber(overview.totalValue)
            .plus(value.overview.totalValue)
            .toFixed(),
          totalDebt: new BigNumber(overview.totalDebt ?? 0)
            .plus(value.overview.totalDebt ?? 0)
            .toFixed(),
          netWorth: new BigNumber(overview.netWorth ?? 0)
            .plus(value.overview.netWorth ?? 0)
            .toFixed(),
          chains: Array.from(
            new Set([...overview.chains, ...value.overview.chains]),
          ),
          protocolCount: new BigNumber(overview.protocolCount ?? 0)
            .plus(value.overview.protocolCount ?? 0)
            .toNumber(),
          positionCount: new BigNumber(overview.positionCount ?? 0)
            .plus(value.overview.positionCount ?? 0)
            .toNumber(),
        };
        set(deFiListOverviewAtom(), newOverview);
      } else {
        set(deFiListOverviewAtom(), value.overview);
      }
    },
  );

  updateDeFiListProtocols = contextAtomMethod(
    (
      get,
      set,
      value: {
        protocols: IDeFiProtocol[];
        merge?: boolean;
      },
    ) => {
      const protocols = get(deFiListProtocolsAtom());
      const { protocolMap } = get(deFiListProtocolMapAtom());

      if (value.merge) {
        set(deFiListProtocolsAtom(), {
          protocols: [...protocols.protocols, ...value.protocols].sort(
            (a, b) => {
              return new BigNumber(
                protocolMap[
                  defiUtils.buildProtocolMapKey({
                    protocol: b.protocol,
                    networkId: b.networkId,
                  })
                ]?.totalValue ?? 0,
              ).comparedTo(
                new BigNumber(
                  protocolMap[
                    defiUtils.buildProtocolMapKey({
                      protocol: a.protocol,
                      networkId: a.networkId,
                    })
                  ]?.totalValue ?? 0,
                ),
              );
            },
          ),
        });
      } else {
        set(deFiListProtocolsAtom(), {
          protocols: value.protocols,
        });
      }
    },
  );

  updateDeFiListProtocolMap = contextAtomMethod(
    (
      get,
      set,
      value: {
        merge?: boolean;
        protocolMap: Record<string, IProtocolSummary>;
      },
    ) => {
      const protocolMap = get(deFiListProtocolMapAtom());

      if (value.merge) {
        set(deFiListProtocolMapAtom(), {
          protocolMap: {
            ...protocolMap.protocolMap,
            ...value.protocolMap,
          },
        });
      } else {
        set(deFiListProtocolMapAtom(), {
          protocolMap: value.protocolMap,
        });
      }
    },
  );

  updateDeFiListState = contextAtomMethod(
    (
      get,
      set,
      value: {
        isRefreshing?: boolean;
        initialized?: boolean;
      },
    ) => {
      set(deFiListStateAtom(), (v) => ({
        ...v,
        ...value,
      }));
    },
  );
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsDeFiList()', Date.now());
  return new ContextJotaiActionsDeFiList();
});

export function useDeFiListActions() {
  const actions = createActions();

  const updateDeFiListOverview = actions.updateDeFiListOverview.use();
  const updateDeFiListProtocols = actions.updateDeFiListProtocols.use();
  const updateDeFiListProtocolMap = actions.updateDeFiListProtocolMap.use();
  const updateDeFiListState = actions.updateDeFiListState.use();

  return useRef({
    updateDeFiListOverview,
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  });
}
