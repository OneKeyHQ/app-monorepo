import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, HStack, RadioFee, Text } from '@onekeyhq/components';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type {
  IFeeInfo,
  IFeeInfoPayload,
} from '@onekeyhq/engine/src/vaults/types';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
} from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';

import { FormatCurrencyNativeOfAccount } from '../../../../components/Format';
import { FeeSpeedLabel } from '../../components/FeeSpeedLabel';
import { FeeSpeedTime } from '../../components/FeeSpeedTime';
import { FeeSpeedTip } from '../../components/FeeSpeedTip';

const presetItemStyle = {
  marginTop: 2,
  paddingLeft: '16px',
  paddingRight: '16px',
  paddingTop: '8px',
  paddingBottom: '8px',
  alignItems: 'center',
};

const customItemStyle = {
  ...presetItemStyle,
  marginTop: 6,
};

export type IStandardFeeProps = {
  feeInfoPayload: IFeeInfoPayload | null;
  value: string;
  onChange: (v: string) => void;
  accountId: string;
  networkId: string;
};
export function SendEditFeeStandardForm({
  feeInfoPayload,
  value,
  onChange,
  accountId,
  networkId,
}: IStandardFeeProps) {
  const intl = useIntl();

  const customFeeInfo = feeInfoPayload?.selected.custom;
  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;

  const getCustomFeeSpeedTime = useCallback(() => {
    if (!customFeeInfo) return null;

    let customWaitingSeconds = 0;
    let customSimilarToPreset = 0;
    const prices = feeInfoPayload?.info.prices ?? [];
    const waitingSeconds = feeInfoPayload?.info.waitingSeconds ?? [];
    const low = {
      price: prices[0],
      waitingSeconds: waitingSeconds[0],
    };
    const medium = {
      price: prices[1],
      waitingSeconds: waitingSeconds[1],
    };
    const high = {
      price: prices[2],
      waitingSeconds: waitingSeconds[2],
    };
    if (isEIP1559Fee) {
      const customPriorityBN = new BigNumber(
        customFeeInfo?.price1559?.maxPriorityFeePerGas ?? 0,
      );
      if (
        customPriorityBN.isGreaterThanOrEqualTo(
          (medium.price as EIP1559Fee).maxPriorityFeePerGas,
        )
      ) {
        if (
          customPriorityBN.isLessThan(
            (high.price as EIP1559Fee).maxPriorityFeePerGas,
          )
        ) {
          // Medium
          customWaitingSeconds = medium.waitingSeconds;
          customSimilarToPreset = 1;
        } else {
          // High
          customWaitingSeconds = high.waitingSeconds;
          customSimilarToPreset = 2;
        }
      } else {
        customWaitingSeconds = low.waitingSeconds;
        customSimilarToPreset = 0;
      }

      return (
        <FeeSpeedTime
          index={customSimilarToPreset}
          waitingSeconds={customWaitingSeconds}
        />
      );
    }
  }, [
    customFeeInfo,
    feeInfoPayload?.info.prices,
    feeInfoPayload?.info.waitingSeconds,
    isEIP1559Fee,
  ]);

  const selectedFeeInfo = useMemo(() => {
    let feeInfo = null;
    if (value === 'custom') {
      feeInfo = isEIP1559Fee
        ? feeInfoPayload?.selected.custom?.price1559
        : feeInfoPayload?.selected.custom?.price;
    } else {
      feeInfo = feeInfoPayload?.info?.prices[Number(value)];
    }

    let minFeeNative = '';
    let totalFeeNative = '';

    if (isEIP1559Fee) {
      const { min, max } = calculateTotalFeeRange({
        eip1559: true,
        limit: feeInfoPayload?.info?.limit,
        price1559: feeInfo as EIP1559Fee,
      });
      const minFee = min;
      totalFeeNative = calculateTotalFeeNative({
        amount: max,
        info: feeInfoPayload?.info,
      });

      minFeeNative = calculateTotalFeeNative({
        amount: minFee,
        info: feeInfoPayload?.info,
      });
    } else {
      const totalFee = calculateTotalFeeRange({
        limit: feeInfoPayload?.info?.limit,
        price: feeInfo as string,
      }).max;
      totalFeeNative = calculateTotalFeeNative({
        amount: totalFee,
        info: feeInfoPayload?.info as IFeeInfo,
      });
    }

    return (
      <Box>
        <Text typography="Body2Strong" textAlign="center">
          {minFeeNative || totalFeeNative}
          {feeInfoPayload?.info.nativeSymbol ?? ''}
        </Text>
        <Text typography="Display2XLarge" textAlign="center">
          {minFeeNative ? (
            <FormatCurrencyNativeOfAccount
              accountId={accountId}
              networkId={networkId}
              value={minFeeNative}
              render={(ele) => <>{!minFeeNative ? '-' : ele}</>}
            />
          ) : (
            <FormatCurrencyNativeOfAccount
              accountId={accountId}
              networkId={networkId}
              value={totalFeeNative}
              render={(ele) => <>{!totalFeeNative ? '-' : ele}</>}
            />
          )}
        </Text>
        {minFeeNative && (
          <Text
            typography="Body2"
            color="text-subdued"
            textAlign="center"
            mt={1}
          >
            {intl.formatMessage({ id: 'content__max_fee' })}:
            <FormatCurrencyNativeOfAccount
              accountId={accountId}
              networkId={networkId}
              value={totalFeeNative}
              render={(ele) => <>{!totalFeeNative ? '-' : ele}</>}
            />
            {`(${totalFeeNative}${feeInfoPayload?.info.nativeSymbol ?? ''})`}
          </Text>
        )}
      </Box>
    );
  }, [
    accountId,
    feeInfoPayload?.info,
    feeInfoPayload?.selected.custom?.price,
    feeInfoPayload?.selected.custom?.price1559,
    intl,
    isEIP1559Fee,
    networkId,
    value,
  ]);

  const gasList = useMemo(
    () => feeInfoPayload?.info?.prices ?? [],
    [feeInfoPayload?.info?.prices],
  );
  const gasItems = useMemo(() => {
    if (!gasList) return [];

    const items = gasList.map((gas, index) => {
      const waitingSeconds = (feeInfoPayload?.info as IFeeInfo)
        .waitingSeconds?.[index];

      return {
        value: index.toString(),
        title: <FeeSpeedLabel index={index} iconSize={28} />,

        describeSecond: (
          <HStack space="10px" alignItems="center">
            <FeeSpeedTime index={index} waitingSeconds={waitingSeconds} />
            <FeeSpeedTip index={index} />
          </HStack>
        ),
        ...presetItemStyle,
      };
    });

    if (!feeInfoPayload?.info.customDisabled) {
      items.push({
        value: 'custom',
        title: <FeeSpeedLabel isCustom iconSize={28} />,

        describeSecond: (
          <HStack space="10px" alignItems="center">
            {getCustomFeeSpeedTime()}
            <FeeSpeedTip isCustom />
          </HStack>
        ),
        ...customItemStyle,
      });
    }

    return items;
  }, [feeInfoPayload?.info, gasList, getCustomFeeSpeedTime]);

  return (
    <Box>
      {selectedFeeInfo}
      <RadioFee
        padding="0px"
        mt={5}
        items={gasItems}
        name="standard fee group"
        value={value}
        onChange={(index) => onChange(index)}
      />
    </Box>
  );
}
