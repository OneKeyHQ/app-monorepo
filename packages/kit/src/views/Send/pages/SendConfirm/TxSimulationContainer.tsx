import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  useNativeTokenInfoAtom,
  useSendSelectedFeeInfoAtom,
  useUnsignedTxsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISendSelectedFeeInfo } from '@onekeyhq/shared/types/fee';

import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';

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
    <XStack alignItems="center" space="$2">
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
        size="$bodyMd"
        color="$textSubdued"
      >
        {label}
      </NumberSizeableText>
    </XStack>
  );
}

function TxSimulationContainer({ tableLayout }: { tableLayout?: boolean }) {
  const intl = useIntl();
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
    <>
      <Divider mx="$5" />
      <InfoItemGroup>
        <InfoItem
          label={
            <SizableText size="$headingXs" color="$textDisabled">
              {intl.formatMessage({ id: ETranslations.for_reference_only })}
            </SizableText>
          }
        />
        <InfoItem
          compact
          label={intl.formatMessage({
            id: ETranslations.global_total_out_include_fee,
          })}
          renderContent={renderTxSimulation(simulationDataOut)}
        />
        {simulationDataIn.length > 0 ? (
          <InfoItem
            compact
            label={intl.formatMessage({ id: ETranslations.global_total_in })}
            renderContent={renderTxSimulation(simulationDataIn)}
          />
        ) : null}
      </InfoItemGroup>
    </>
  );
}

export default memo(TxSimulationContainer);
