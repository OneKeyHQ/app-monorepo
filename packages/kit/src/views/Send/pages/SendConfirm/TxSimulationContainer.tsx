import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Icon,
  Image,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Container } from '@onekeyhq/kit/src/components/Container';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import {
  useSendSelectedFeeInfoAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';

export type ITxSimulationItem = {
  label: string;
  icon: string;
  symbol: string;
  isNFT?: boolean;
};

function SimulationItem(item: ITxSimulationItem) {
  const { label, icon, isNFT, symbol } = item;

  return (
    <XStack alignItems="center" space="$1">
      <ListItem.Avatar
        src={icon}
        size="$5"
        circular={!isNFT}
        fallbackProps={{
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: (
            <Icon
              name={isNFT ? 'QuestionmarkOutline' : 'ImageMountainSolid'}
              color="$iconSubdued"
            />
          ),
        }}
      />
      <NumberSizeableText
        formatter="balance"
        formatterOptions={{ showPlusMinusSigns: true, tokenSymbol: symbol }}
        size="$bodyMdMedium"
      >
        {label}
      </NumberSizeableText>
    </XStack>
  );
}

function TxSimulationContainer({
  networkId,
  tableLayout,
}: {
  tableLayout?: boolean;
  networkId: string;
}) {
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();
  const { network } = useAccountData({ networkId });

  const swapInfo = unsignedTxs[0]?.swapInfo;

  const simulationDataIn = useMemo(() => {
    if (!swapInfo) return [];
    return [
      {
        label: `+${swapInfo.receiver.amount}`,
        icon: swapInfo.receiver.token.logoURI ?? '',
        symbol: swapInfo.receiver.token.symbol,
      },
    ];
  }, [swapInfo]);
  const simulationDataOut = useMemo(() => {
    if (!swapInfo) return [];

    if (swapInfo.sender.token.isNative) {
      return [
        {
          label: `-${new BigNumber(swapInfo.sender.amount)
            .plus(sendSelectedFeeInfo?.totalNativeForDisplay ?? 0)
            .toFixed()}`,
          icon: swapInfo.sender.token.logoURI ?? '',
          symbol: swapInfo.sender.token.symbol,
        },
      ];
    }

    return [
      {
        label: `-${swapInfo.sender.amount}`,
        icon: swapInfo.sender.token.logoURI ?? '',
        symbol: swapInfo.sender.token.symbol,
      },
      {
        label: `-${sendSelectedFeeInfo?.totalNativeForDisplay ?? '0'}`,
        icon: network?.logoURI ?? '',
        symbol: sendSelectedFeeInfo?.feeInfo.common.nativeSymbol ?? '',
      },
    ];
  }, [
    network?.logoURI,
    sendSelectedFeeInfo?.feeInfo.common.nativeSymbol,
    sendSelectedFeeInfo?.totalNativeForDisplay,
    swapInfo,
  ]);

  const renderTxSimulation = useCallback(
    (simulation: ITxSimulationItem[]) => (
      <YStack space="$1">
        {simulation.map((item, index) => (
          <SimulationItem {...item} key={index} />
        ))}
      </YStack>
    ),
    [],
  );

  // for now just internal swap info
  if (!swapInfo) return null;

  return (
    <Container.Box>
      <Container.Item
        title="Total out"
        subtitle="Include fee"
        content={renderTxSimulation(simulationDataOut)}
      />
      <Container.Item
        title="Total in"
        content={renderTxSimulation(simulationDataIn)}
      />
      <Container.Item
        content={
          tableLayout ? null : (
            <SizableText size="$bodySm" color="$textSubdued">
              For reference only
            </SizableText>
          )
        }
        contentAdd={
          <XStack alignItems="center" space="$1">
            <SizableText size="$bodySmMedium" color="$textSubdued">
              Power by
            </SizableText>
            <Image
              w={58}
              h={12}
              src="https://assets-global.website-files.com/64ec731552ca9f8cc0180db8/64eca09007998d22c2590665_Vector.svg"
            />
          </XStack>
        }
      />
    </Container.Box>
  );
}

export default memo(TxSimulationContainer);
