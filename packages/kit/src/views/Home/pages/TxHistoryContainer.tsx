import { useCallback } from 'react';

import { useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { TxHistoryListView } from '../../../components/TxHistoryListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../routes/Modal/type';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { EModalAssetDetailRoutes } from '../../AssetDetails/router/types';
import { DEBOUNCE_INTERVAL, POLLING_INTERVAL_FOR_HISTORY } from '../constants';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function TxHistoryListContainer(props: IProps) {
  const { onContentSizeChange } = props;

  const media = useMedia();
  const navigation = useAppNavigation();
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const handleHistoryItemPress = useCallback(
    (history: IAccountHistoryTx) => {
      if (!account || !network) return;
      navigation.pushModal(EModalRoutes.MainModal, {
        screen: EModalAssetDetailRoutes.HistoryDetails,
        params: {
          networkId: network.id,
          historyTx: history,
        },
      });
    },
    [account, navigation, network],
  );

  const history = usePromiseResult(
    async () => {
      if (!account || !network) return;
      const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId: account.id,
        networkId: network.id,
      });
      return r;
    },
    [account, network],
    {
      debounced: DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
    },
  );

  return (
    <TxHistoryListView
      data={history.result ?? []}
      onPressHistory={handleHistoryItemPress}
      showHeader
      isLoading={history.isLoading}
      onContentSizeChange={onContentSizeChange}
      {...(media.gtLg && {
        tableLayout: true,
      })}
    />
  );
}

export { TxHistoryListContainer };
