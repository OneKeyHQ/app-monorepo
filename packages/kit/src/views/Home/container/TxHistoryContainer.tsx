import { useMemo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useFormatDate from '../../../hooks/useFormatDate';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { convertHistoryToSectionGroups } from '../../../utils/history';
import { TxHistoryListView } from '../components/TxHistoryListView';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

const accountAddress = '0x76f3f64cb3cD19debEE51436dF630a342B736C24';

function TxHistoryListContainer(props: IProps) {
  const { onContentSizeChange } = props;
  const formatDate = useFormatDate();

  const history = usePromiseResult(async () => {
    const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
      accountId: "hd-1--m/44'/60'/0'/0/0",
      networkId: 'evm--1',
      accountAddress,
    });
    return r;
  }, []);

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
      data={historySections}
      isLoading={history.isLoading}
      accountAddress={accountAddress}
      onContentSizeChange={onContentSizeChange}
    />
  );
}

export { TxHistoryListContainer };
