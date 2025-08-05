import { useRef } from 'react';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IAddressInfo } from '@onekeyhq/shared/types/address';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';
import type { IToken } from '@onekeyhq/shared/types/token';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  approvalListAtom,
  approvalListStateAtom,
  contextAtomMethod,
  contractMapAtom,
  tokenMapAtom,
} from './atoms';

class ContextJotaiActionsApprovalList extends ContextJotaiActionsBase {
  updateApprovalList = contextAtomMethod(
    (get, set, value: { data: IContractApproval[] }) => {
      set(approvalListAtom(), {
        approvals: value.data,
      });
    },
  );

  updateTokenMap = contextAtomMethod(
    (
      get,
      set,
      value: {
        data: Record<
          string,
          {
            price: string;
            price24h: string;
            info: IToken;
          }
        >;
      },
    ) => {
      set(tokenMapAtom(), {
        tokenMap: value.data,
      });
    },
  );

  updateContractMap = contextAtomMethod(
    (get, set, value: { data: Record<string, IAddressInfo> }) => {
      set(contractMapAtom(), {
        contractMap: value.data,
      });
    },
  );

  updateApprovalListState = contextAtomMethod(
    (
      get,
      set,
      payload: {
        isRefreshing?: boolean;
        initialized?: boolean;
      },
    ) => {
      set(approvalListStateAtom(), (v) => ({
        ...v,
        ...payload,
      }));
    },
  );
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsApprovalList()', Date.now());
  return new ContextJotaiActionsApprovalList();
});

export function useApprovalListActions() {
  const actions = createActions();

  const updateApprovalList = actions.updateApprovalList.use();
  const updateTokenMap = actions.updateTokenMap.use();
  const updateContractMap = actions.updateContractMap.use();
  const updateApprovalListState = actions.updateApprovalListState.use();

  return useRef({
    updateApprovalList,
    updateTokenMap,
    updateContractMap,
    updateApprovalListState,
  });
}
