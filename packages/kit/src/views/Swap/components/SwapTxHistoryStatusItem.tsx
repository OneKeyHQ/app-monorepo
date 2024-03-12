import { useMemo } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Button, Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

interface ISwapTxHistoryStatusItemProps {
  statusTitle: string;
  status: ESwapTxHistoryStatus;
  usedTime?: string;
  onSwapAgain?: () => void;
}

const SwapTxHistoryStatusItem = ({
  onSwapAgain,
  statusTitle,
  status,
  usedTime,
}: ISwapTxHistoryStatusItemProps) => {
  const iconProps = useMemo(() => {
    let iconName: IKeyOfIcons = 'MoreIllus';
    let iconBackgroundColor = 'blue';
    if (status === ESwapTxHistoryStatus.FAILED) {
      iconName = 'XCircleOutline';
      iconBackgroundColor = 'red';
    }
    if (status === ESwapTxHistoryStatus.SUCCESS) {
      iconName = 'CheckRadioOutline';
      iconBackgroundColor = 'green';
    }

    return { iconName, iconBackgroundColor };
  }, [status]);

  return (
    <XStack justifyContent="space-between">
      <XStack>
        <Icon
          name={iconProps.iconName}
          size="$20"
          borderRadius={40}
          backgroundColor={iconProps.iconBackgroundColor}
        />
        <YStack>
          <SizableText>{statusTitle}</SizableText>
          {usedTime && <SizableText>{usedTime}</SizableText>}
        </YStack>
      </XStack>
      {status !== ESwapTxHistoryStatus.PENDING && (
        <Button onPress={onSwapAgain}>Swap Again</Button>
      )}
    </XStack>
  );
};

export default SwapTxHistoryStatusItem;
