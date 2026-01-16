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
  deFiListProtocolMapAtom,
  deFiListProtocolsAtom,
  deFiListStateAtom,
} from './atoms';

class ContextJotaiActionsDeFiList extends ContextJotaiActionsBase {
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

  const updateDeFiListProtocols = actions.updateDeFiListProtocols.use();
  const updateDeFiListProtocolMap = actions.updateDeFiListProtocolMap.use();
  const updateDeFiListState = actions.updateDeFiListState.use();

  return useRef({
    updateDeFiListProtocols,
    updateDeFiListProtocolMap,
    updateDeFiListState,
  });
}
