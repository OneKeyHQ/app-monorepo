import { useRef } from 'react';

import { uniqBy } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IAddressInfo } from '@onekeyhq/shared/types/address';
import type { IAccountApproval } from '@onekeyhq/shared/types/approval';
import type { IToken } from '@onekeyhq/shared/types/token';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  approvalListAtom,
  contextAtomMethod,
  contractMapAtom,
  tokenMapAtom,
} from './atoms';

class ContextJotaiActionsApprovalList extends ContextJotaiActionsBase {
  updateApprovalList = contextAtomMethod(
    (get, set, value: { data: IAccountApproval[]; merge?: boolean }) => {
      const approvals = get(approvalListAtom());

      if (value.merge) {
        const mergeApprovals = uniqBy(
          [...approvals.approvals, ...value.data],
          (approval) => `${approval.tokenAddress}_${approval.spenderAddress}`,
        );
        set(approvalListAtom(), {
          approvals: mergeApprovals,
        });
      } else {
        set(approvalListAtom(), {
          approvals: value.data,
        });
      }
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
        merge?: boolean;
      },
    ) => {
      const tokenMap = get(tokenMapAtom());

      if (value.merge) {
        set(tokenMapAtom(), {
          tokenMap: {
            ...tokenMap.tokenMap,
            ...value.data,
          },
        });
      } else {
        set(tokenMapAtom(), {
          tokenMap: value.data,
        });
      }
    },
  );

  updateContractMap = contextAtomMethod(
    (
      get,
      set,
      value: { data: Record<string, IAddressInfo>; merge?: boolean },
    ) => {
      const contractMap = get(contractMapAtom());

      if (value.merge) {
        set(contractMapAtom(), {
          contractMap: {
            ...contractMap.contractMap,
            ...value.data,
          },
        });
      } else {
        set(contractMapAtom(), {
          contractMap: value.data,
        });
      }

      void backgroundApiProxy.serviceHistory.updateLocalAddressesInfo({
        data: value.data,
        merge: value.merge,
      });
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

  return useRef({
    updateApprovalList,
    updateTokenMap,
    updateContractMap,
  });
}
