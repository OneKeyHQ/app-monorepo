import { useEffect, useMemo } from 'react';

import { Select, Text } from '@onekeyhq/components';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

const { serviceAccount } = backgroundApiProxy;

export function DeriveTypeSelectorTrigger({ num }: { num: number }) {
  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();
  const [isReady] = useAccountSelectorStorageReadyAtom();

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
  }, [selectedAccount.networkId]);
  const currentDeriveInfo = useMemo(
    () =>
      deriveInfoItems.find((item) => item.value === selectedAccount.deriveType),
    [deriveInfoItems, selectedAccount.deriveType],
  );
  useEffect(() => {
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
    actions,
    currentDeriveInfo,
    deriveInfoItems,
    num,
    selectedAccount.deriveType,
  ]);

  if (!isReady) {
    return null;
  }

  return (
    <>
      <Text variant="$headingXl">
        派生选择器{' '}
        {accountUtils.beautifyPathTemplate({
          template: currentDeriveInfo?.item?.template || '',
        })}
      </Text>
      <Select
        key={`${selectedAccount.deriveType}-${selectedAccount.networkId || ''}`}
        items={deriveInfoItems}
        value={selectedAccount.deriveType}
        onChange={(type) =>
          actions.current.updateSelectedAccount({
            num,
            builder: (v) => ({
              ...v,
              deriveType: type as any,
            }),
          })
        }
        title="派生类型"
      />
    </>
  );
}
