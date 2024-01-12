import { useCallback, useMemo } from 'react';

import { useMedia } from 'tamagui';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../routes/Modal/type';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { ETokenPages } from '../../Token/router/type';
import { TxHistoryListView } from '../components/TxHistoryListView';
import { DEBOUNCE_INTERVAL, POLLING_INTERVAL_FOR_HISTORY } from '../constants';

import { mockData } from './mockData';

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

  const handleHistoryItemPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.TokenModal, {
      screen: ETokenPages.History,
    });
  }, [navigation]);

  const history = usePromiseResult(
    async () => {
      if (!account || !network) return;
      const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId: account.id,
        networkId: network.id,
        accountAddress: account.address,
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
      onItemPress={handleHistoryItemPress}
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
