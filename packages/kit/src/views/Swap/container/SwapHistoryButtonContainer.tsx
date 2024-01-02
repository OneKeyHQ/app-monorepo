import { Button, IconButton } from '@onekeyhq/components';

import {
  useSwapTxHistoryListSyncFromSimpleDb,
  useSwapTxHistoryStateSyncInterval,
} from '../hooks/useSwapTxHistory';

interface ISwapHistoryButtonContainerProps {
  onHistoryButtonPress: () => void;
}

const SwapHistoryButtonContainer = ({
  onHistoryButtonPress,
}: ISwapHistoryButtonContainerProps) => {
  useSwapTxHistoryListSyncFromSimpleDb();
  const { swapTxHistoryPending } = useSwapTxHistoryStateSyncInterval();
  console.log('swapTxHistoryPending-', swapTxHistoryPending);
  return swapTxHistoryPending.length > 0 ? (
    <Button
      onPress={onHistoryButtonPress}
    >{`${swapTxHistoryPending.length} pending swap`}</Button>
  ) : (
    <IconButton icon="ClockTimeHistorySolid" onPress={onHistoryButtonPress} />
  );
};

export default SwapHistoryButtonContainer;
