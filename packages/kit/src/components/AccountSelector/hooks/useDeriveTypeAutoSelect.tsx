import { useEffect, useMemo } from 'react';

import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';

export function useDeriveTypeAutoSelect({ num }: { num: number }) {
  const { serviceAccount } = backgroundApiProxy;
  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();
  const [isReady] = useAccountSelectorStorageReadyAtom();

  // build derive type list
  const { result: deriveInfoItems = [] } = usePromiseResult(async () => {
    if (!selectedAccount.networkId) {
      return [];
    }
    const map = await serviceAccount.getDeriveInfoMapOfNetwork({
      networkId: selectedAccount.networkId,
    });
    return Object.entries(map).map(([k, v]) => ({
      value: k,
      item: v,
      label:
        (v.labelKey
          ? appLocale.intl.formatMessage({ id: v.labelKey })
          : v.label) || k,
    }));
  }, [selectedAccount.networkId, serviceAccount]);

  // build selected derive item info
  const currentDeriveInfo = useMemo(
    () =>
      deriveInfoItems.find((item) => item.value === selectedAccount.deriveType),
    [deriveInfoItems, selectedAccount.deriveType],
  );

  // auto select first derive type
  // TODO auto select global default derive type
  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (
      !currentDeriveInfo &&
      deriveInfoItems.length > 0 &&
      deriveInfoItems[0].value &&
      selectedAccount.deriveType !== deriveInfoItems[0].value
    ) {
      actions.current.updateSelectedAccount({
        num,
        builder: (v) => ({
          ...v,
          deriveType: deriveInfoItems[0].value as IAccountDeriveTypes,
        }),
      });
    }
  }, [
    isReady,
    actions,
    currentDeriveInfo,
    deriveInfoItems,
    num,
    selectedAccount.deriveType,
  ]);

  return {
    deriveInfoItems,
    currentDeriveInfo,
  };
}
