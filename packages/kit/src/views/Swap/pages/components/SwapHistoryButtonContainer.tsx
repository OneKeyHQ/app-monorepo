import { Button, IconButton } from '@onekeyhq/components';

import {
  useSwapTxHistoryListSyncFromSimpleDb,
  useSwapTxHistoryStateSyncInterval,
} from '../../hooks/useSwapTxHistory';

interface ISwapHistoryButtonContainerProps {
  onHistoryButtonPress: () => void;
}

const SwapHistoryButtonContainer = ({
  onHistoryButtonPress,
}: ISwapHistoryButtonContainerProps) => {
  useSwapTxHistoryListSyncFromSimpleDb();
  const { swapTxHistoryPending } = useSwapTxHistoryStateSyncInterval();
  return swapTxHistoryPending.length > 0 ? (
    <Button
      onPress={onHistoryButtonPress}
      variant="secondary"
      size="medium"
      icon="Ai3StarOutline"
      backgroundColor="$bgInfo"
    >{`${swapTxHistoryPending.length} Pending `}</Button>
  ) : (
    <IconButton icon="ClockTimeHistorySolid" onPress={onHistoryButtonPress} />
  );
};

export default SwapHistoryButtonContainer;
