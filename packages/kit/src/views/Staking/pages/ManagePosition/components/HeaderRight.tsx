import { Button, XStack } from '@onekeyhq/components';
import type { IEarnHistoryActionIcon } from '@onekeyhq/shared/types/staking';

export enum EManagePositionHeaderRightActions {
  History = 'history',
}

export const HeaderRight = ({
  historyAction,
  onHistory,
}: {
  historyAction?: IEarnHistoryActionIcon;
  onHistory?: ((params?: { filterType?: string }) => void) | undefined;
}) => {
  if (historyAction && !historyAction?.disabled) {
    return (
      <XStack ai="center">
        <Button
          h="$8"
          mr="unset"
          variant="tertiary"
          icon="ClockTimeHistoryOutline"
          size="small"
          disabled={historyAction.disabled}
          onPress={onHistory}
        >
          {historyAction.text.text}
        </Button>
      </XStack>
    );
  }

  return null;
};
