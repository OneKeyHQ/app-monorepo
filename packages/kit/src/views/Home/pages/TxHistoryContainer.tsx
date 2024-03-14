import { useCallback, useRef, useState } from 'react';

import { useMedia, useTabIsRefreshingFocused } from '@onekeyhq/components';
import type { ITabPageProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_HISTORY,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EModalAssetDetailRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { TxHistoryListView } from '../../../components/TxHistoryListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

function TxHistoryListContainer(props: ITabPageProps) {
  const { onContentSizeChange } = props;
  const { isFocused } = useTabIsRefreshingFocused();

  const [initialized, setInitialized] = useState(false);
  const media = useMedia();
  const navigation = useAppNavigation();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });
  const currentAccountId = useRef<string>('');

  const handleHistoryItemPress = useCallback(
    (history: IAccountHistoryTx) => {
      if (!account || !network) return;
      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.HistoryDetails,
        params: {
          networkId: network.id,
          accountAddress: account.address,
          historyTx: history,
        },
      });
    },
    [account, navigation, network],
  );

  const history = usePromiseResult(
    async () => {
      if (!account || !network) return;
      if (currentAccountId.current !== account.id) {
        currentAccountId.current = account.id;
        setInitialized(false);
      }
      const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId: account.id,
        networkId: network.id,
        accountAddress: account.address,
      });
      setInitialized(true);
      return r;
    },
    [account, network],
    {
      watchLoading: true,
      overrideIsFocused: (isPageFocused) => isPageFocused && isFocused,
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
    },
  );

  return (
    <TxHistoryListView
      showIcon
      data={history.result ?? []}
      onPressHistory={handleHistoryItemPress}
      showHeader
      isLoading={history.isLoading}
      initialized={initialized}
      onContentSizeChange={onContentSizeChange}
      {...(media.gtLg && {
        tableLayout: true,
      })}
    />
  );
}

export { TxHistoryListContainer };
