import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import {
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Container } from '@onekeyhq/kit/src/components/Container';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  useNativeTokenInfoAtom,
  useSendSelectedFeeInfoAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import type { ISendSelectedFeeInfo } from '@onekeyhq/shared/types/fee';

export type ITxSimulationItem = {
  label: string;
  icon: string;
  symbol: string;
  isNFT?: boolean;
};

interface ITxSimulationToken {
  symbol: string;
  logoURI?: string;
  isNative?: boolean;
}

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

function TxSimulationContainer({ tableLayout }: { tableLayout?: boolean }) {
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();
  const [nativeTokenInfo] = useNativeTokenInfoAtom();

  const swapInfo = unsignedTxs[0]?.swapInfo;
  const stakingInfo = unsignedTxs[0]?.stakingInfo;

  const simulationDataIn = useMemo(() => {
    if (swapInfo) {
      return [
        {
          label: `+${swapInfo.receiver.amount}`,
          icon: swapInfo.receiver.token.logoURI ?? '',
          symbol: swapInfo.receiver.token.symbol,
        },
      ];
    }
    if (stakingInfo?.receive) {
      const receive = stakingInfo.receive;
      return [
        {
          label: `+${receive.amount}`,
          icon: receive.token.logoURI ?? '',
          symbol: receive.token.symbol,
        },
      ];
    }
    return [];
  }, [swapInfo, stakingInfo]);
  const simulationDataOut = useMemo(() => {
    const generateTxSimulationItem = ({
      token,
      amount,
      feeInfo,
      nativeToken,
    }: {
      amount: string;
      token: ITxSimulationToken;
      feeInfo?: ISendSelectedFeeInfo;
      nativeToken: { logoURI?: string };
    }): ITxSimulationItem[] => {
      if (token.isNative || !feeInfo) {
        return [
          {
            label: `-${new BigNumber(amount)
              .plus(feeInfo?.totalNativeForDisplay ?? 0)
              .toFixed()}`,
            icon: token.logoURI ?? '',
            symbol: token.symbol,
          },
        ];
      }
      return [
        {
          label: `-${amount}`,
          icon: token.logoURI ?? '',
          symbol: token.symbol,
        },
        {
          label: `-${feeInfo?.totalNativeForDisplay ?? '0'}`,
          icon: nativeToken?.logoURI ?? '',
          symbol: feeInfo?.feeInfo.common.nativeSymbol ?? '',
        },
      ];
    };
    if (swapInfo) {
      return generateTxSimulationItem({
        token: swapInfo.sender.token,
        amount: swapInfo.sender.amount,
        feeInfo: sendSelectedFeeInfo,
        nativeToken: nativeTokenInfo,
      });
    }
    if (stakingInfo?.send) {
      return generateTxSimulationItem({
        token: stakingInfo.send.token,
        amount: stakingInfo.send.amount,
        feeInfo: sendSelectedFeeInfo,
        nativeToken: nativeTokenInfo,
      });
    }

    return [];
  }, [sendSelectedFeeInfo, swapInfo, stakingInfo, nativeTokenInfo]);

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
  if (!swapInfo && !stakingInfo) return null;

  return (
    <Container.Box>
      <Container.Item
        title="Total out"
        subtitle="Include fee"
        content={renderTxSimulation(simulationDataOut)}
      />
      {simulationDataIn.length > 0 ? (
        <Container.Item
          title="Total in"
          content={renderTxSimulation(simulationDataIn)}
        />
      ) : null}
      <Container.Item
        content={
          tableLayout ? null : (
            <SizableText size="$bodySm" color="$textSubdued">
              For reference only
            </SizableText>
          )
        }
      />
    </Container.Box>
  );
}

export default memo(TxSimulationContainer);
