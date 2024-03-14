import { useTabIsRefreshingFocused } from '@onekeyhq/components';
import type { ITabPageProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { DefiListView } from '../components/DefiListView';

function DefiListContainer(props: ITabPageProps) {
  const { onContentSizeChange } = props;
  const { isFocused } = useTabIsRefreshingFocused();

  const defi = usePromiseResult(
    async () => {
      const r = await backgroundApiProxy.serviceDefi.fetchAccountDefi({
        networkId: 'evm--1',
        accountAddress: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
      });
      return r.data;
    },
    [],
    { overrideIsFocused: (isPageFocused) => isPageFocused && isFocused },
  );
  return (
    <DefiListView
      data={defi.result ?? []}
      onContentSizeChange={onContentSizeChange}
    />
  );
}

export { DefiListContainer };
