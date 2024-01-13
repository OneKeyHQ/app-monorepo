import { useCallback, useMemo } from 'react';

import { useMedia } from 'tamagui';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import useAppNavigation from '../../../hooks/useAppNavigation';
import useFormatDate from '../../../hooks/useFormatDate';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { EModalRoutes } from '../../../routes/Modal/type';
import { convertHistoryToSectionGroups } from '../../../utils/history';
import { ETokenPages } from '../../Token/router/type';
import { TxHistoryListView } from '../components/TxHistoryListView';
import { DEBOUNCE_INTERVAL, POLLING_INTERVAL_FOR_HISTORY } from '../constants';

import { mockData } from './mockData';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

const accountAddress = '0x76f3f64cb3cD19debEE51436dF630a342B736C24';

function TxHistoryListContainer(props: IProps) {
  const media = useMedia();
  const { onContentSizeChange } = props;
  const formatDate = useFormatDate();
  const navigation = useAppNavigation();

  const handleHistoryItemPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.TokenModal, {
      screen: ETokenPages.History,
    });
  }, [navigation]);

  const history = usePromiseResult(
    async () => {
      const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId: "hd-1--m/44'/60'/0'/0/0",
        networkId: 'evm--1',
        accountAddress,
      });
      return r;
    },
    [],
    {
      debounced: DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_HISTORY,
    },
  );

  const historySections = useMemo(
    () =>
      convertHistoryToSectionGroups({
        items: history.result,
        formatDate: (date: number) =>
          formatDate.formatDate(new Date(date), {
            hideTheYear: true,
            hideTimeForever: true,
          }),
      }),
    [history.result, formatDate],
  );

  return (
    <TxHistoryListView
      data={mockData as any}
      onItemPress={handleHistoryItemPress}
      showHeader
      isLoading={history.isLoading}
      accountAddress={accountAddress}
      onContentSizeChange={onContentSizeChange}
      {...(media.gtLg && {
        tableLayout: true,
      })}
    />
  );
}

export { TxHistoryListContainer };
