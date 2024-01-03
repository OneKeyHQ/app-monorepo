import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { Button } from 'tamagui';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Icon, Text, XStack, YStack } from '@onekeyhq/components';

import { ESwapTxHistoryStatus } from '../types';

import type { ISwapTxHistory } from '../types';

interface ISwapTxHistoryStatusItemProps {
  item: ISwapTxHistory;
  onSwapAgain?: () => void;
}

const SwapTxHistoryStatusItem = ({
  item,
  onSwapAgain,
}: ISwapTxHistoryStatusItemProps) => {
  const statusLabel = useMemo(() => {
    if (item.status === ESwapTxHistoryStatus.FAILED) {
      return 'Failed';
    }
    if (item.status === ESwapTxHistoryStatus.SUCCESS) {
      return 'Success';
    }
    return 'Pending';
  }, [item.status]);
  const usedTimeLabelComponent = useMemo(() => {
    if (item.status === ESwapTxHistoryStatus.PENDING) {
      return null;
    }
    const usedTime = new BigNumber(item.date.updated)
      .minus(new BigNumber(item.date.created))
      .dividedBy(1000)
      .dividedBy(60)
      .toFixed();
    return <Text>{`${usedTime} minutes used`}</Text>;
  }, [item.date.created, item.date.updated, item.status]);

  const iconProps = useMemo(() => {
    let iconName: IKeyOfIcons = 'MoreIllus';
    let iconBackgroundColor = 'blue';
    if (item.status === ESwapTxHistoryStatus.FAILED) {
      iconName = 'XCircleOutline';
      iconBackgroundColor = 'red';
    }
    if (item.status === ESwapTxHistoryStatus.SUCCESS) {
      iconName = 'CheckRadioOutline';
      iconBackgroundColor = 'green';
    }

    return { iconName, iconBackgroundColor };
  }, [item.status]);

  return (
    <XStack>
      <Icon
        name={iconProps.iconName}
        size="$20"
        borderRadius={40}
        backgroundColor={iconProps.iconBackgroundColor}
      />
      <YStack>
        <Text>{statusLabel}</Text>
        {usedTimeLabelComponent}
      </YStack>
      {item.status !== ESwapTxHistoryStatus.PENDING && (
        <Button onPress={onSwapAgain}>Swap Again</Button>
      )}
    </XStack>
  );
};

export default SwapTxHistoryStatusItem;
