import { useMemo } from 'react';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useFormatDate from '../../../hooks/useFormatData';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { convertHistoryToSectionGroups } from '../../../utils/history';
import { TxHistoryListView } from '../components/TxHistoryListView';

type IProps = {
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
};

function TxHistoryListContainer(props: IProps) {
  const { onContentSizeChange } = props;
  const formatDate = useFormatDate();

  const history = usePromiseResult(async () => {
    const r = await backgroundApiProxy.serviceHistory.demoFetchAccountHistory();
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

  console.log(historySections);

  return (
    <TxHistoryListView
      data={historySections}
      isLoading={history.isLoading}
      onContentSizeChange={onContentSizeChange}
    />
  );
}

export { TxHistoryListContainer };
