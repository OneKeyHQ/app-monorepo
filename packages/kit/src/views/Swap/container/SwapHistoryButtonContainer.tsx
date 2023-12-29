import { Button, IconButton } from '@onekeyhq/components';

import {
  useSwapTxHistoryList,
  useSwapTxHistoryStateSyncInterval,
} from '../hooks/useSwapTxHistory';

interface ISwapHistoryButtonContainerProps {
  onHistoryButtonPress: () => void;
}

const SwapHistoryButtonContainer = ({
  onHistoryButtonPress,
}: ISwapHistoryButtonContainerProps) => {
  useSwapTxHistoryList();
  const { swapTxHistoryPending } = useSwapTxHistoryStateSyncInterval();
  return swapTxHistoryPending.length > 0 ? (
    <Button
      onPress={onHistoryButtonPress}
    >{`${swapTxHistoryPending.length} pending swap`}</Button>
  ) : (
    <IconButton icon="ClockTimeHistorySolid" onPress={onHistoryButtonPress} />
  );
};

export default SwapHistoryButtonContainer;
