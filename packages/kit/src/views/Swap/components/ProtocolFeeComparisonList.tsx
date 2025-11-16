import { useCallback, useMemo } from 'react';

import { Image, SizableText, Stack, XStack } from '@onekeyhq/components';
import type { IImageProps } from '@onekeyhq/components';
import { otherWalletFeeData } from '@onekeyhq/shared/types/swap/SwapProvider.constants';

interface IProtocolFeeInfo {
  name: string;
  fee: number;
  color: string;
  icon: IImageProps['source'];
  maxFee: number;
}

interface IProtocolFeeComparisonListProps {
  serviceFee: number;
}

export function ProtocolFeeComparisonList({
  serviceFee,
}: IProtocolFeeComparisonListProps) {
  const renderProtocolFeeListItem = useCallback(
    (item: IProtocolFeeInfo) => (
      <XStack gap="$3" alignItems="center">
        <Stack w={20} h={20}>
          <Image source={item.icon} w={16} h={16} />
        </Stack>
        <Stack flex={1}>
          <Stack
            backgroundColor={item.color}
            borderRadius="$full"
            width={`${item.maxFee > 0 ? (item.fee / item.maxFee) * 100 : 0}%`}
            height="$1"
          />
        </Stack>
        <SizableText
          size="$bodySm"
          color={item.name === 'oneKey' ? '$textSuccess' : '$text'}
          textAlign="right"
        >
          {item.fee}%
        </SizableText>
      </XStack>
    ),
    [],
  );

  const protocolFeeInfoList: IProtocolFeeInfo[] = useMemo(
    () => [
      ...otherWalletFeeData,
      {
        maxFee: 0.875,
        name: 'oneKey',
        fee: serviceFee,
        color: '#44D62C',
        icon: require('@onekeyhq/kit/assets/logo.png'),
      },
    ],
    [serviceFee],
  );

  return (
    <Stack gap="$2">
      {protocolFeeInfoList.map((item) => (
        <Stack key={item.name}>{renderProtocolFeeListItem(item)}</Stack>
      ))}
    </Stack>
  );
}
