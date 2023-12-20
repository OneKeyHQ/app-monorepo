import { Select, Text } from '@onekeyhq/components';
import { mockPresetNetworks } from '@onekeyhq/kit-bg/src/mock';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import {
  useAccountSelectorActions,
  useAccountSelectorStorageReadyAtom,
  useSelectedAccount,
} from '../../states/jotai/contexts/accountSelector';

const getNetworksItems = memoFn(() =>
  // TODO ETC network
  Object.values(mockPresetNetworks).map((item) => ({
    value: item.id,
    label: item.name,
  })),
);

export function NetworkSelectorTrigger({ num }: { num: number }) {
  const { selectedAccount } = useSelectedAccount({ num });
  const actions = useAccountSelectorActions();
  const [isReady] = useAccountSelectorStorageReadyAtom();

  if (!isReady) {
    return null;
  }

  return (
    <>
      <Text variant="$headingXl">网络选择器 {selectedAccount.networkId}</Text>
      <Select
        items={getNetworksItems()}
        value={selectedAccount.networkId}
        onChange={(id) =>
          actions.current.updateSelectedAccount({
            num,
            builder: (v) => ({
              ...v,
              networkId: id,
            }),
          })
        }
        title="网络"
      />
    </>
  );
}
