import { useMemo } from 'react';

import { Select, Text } from '@onekeyhq/components';
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
        items={deriveInfoItems}
        value={selectedAccount.deriveType}
        onValueChange={(type) =>
          actions.current.updateSelectedAccount({
            num,
            builder: (v) => ({
              ...v,
              deriveType: type as any,
            }),
          })
        }
        triggerProps={{ width: '100%' }}
        disablePreventBodyScroll
        title="派生类型"
      />
    </>
  );
}
