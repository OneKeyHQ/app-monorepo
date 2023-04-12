import { useMemo } from 'react';

import { Box, HStack, RadioFee } from '@onekeyhq/components';
import type {
  IFeeInfo,
  IFeeInfoPayload,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/types';

import { FeeSpeedLabel } from '../../components/FeeSpeedLabel';
import {
  CustomFeeSpeedTime,
  FeeSpeedTime,
} from '../../components/FeeSpeedTime';
import { FeeSpeedTip } from '../../components/FeeSpeedTip';
import { SendEditFeeOverview } from '../../components/SendEditFeeOverview';

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
  currentCustom: null | IFeeInfoUnit;
};
export function SendEditFeeStandardForm({
  feeInfoPayload,
  value,
  onChange,
  accountId,
  networkId,
  currentCustom,
}: IStandardFeeProps) {
  const customFeeInfo = currentCustom || feeInfoPayload?.selected.custom;
  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;

  const selectedFeeInfo = useMemo(() => {
    let price = null;
    let limit = '';
    if (value === 'custom') {
      price = isEIP1559Fee ? customFeeInfo?.price1559 : customFeeInfo?.price;
      limit = customFeeInfo?.limit ?? '0';
    } else {
      price = feeInfoPayload?.info?.prices[Number(value)];
      limit = feeInfoPayload?.info.limit ?? '0';
    }

    return (
      <SendEditFeeOverview
        accountId={accountId}
        networkId={networkId}
        feeInfo={feeInfoPayload?.info}
        price={price}
        limit={limit}
      />
    );
  }, [
    accountId,
    customFeeInfo?.limit,
    customFeeInfo?.price,
    customFeeInfo?.price1559,
    feeInfoPayload?.info,
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
            <FeeSpeedTip
              index={index}
              isEIP1559={feeInfoPayload?.info.eip1559}
              price={gas}
              limit={feeInfoPayload?.info.limit ?? '0'}
            />
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
            <CustomFeeSpeedTime
              isEIP1559Fee={isEIP1559Fee}
              waitingSeconds={feeInfoPayload?.info.waitingSeconds ?? []}
              custom={customFeeInfo}
              prices={feeInfoPayload?.info.prices ?? []}
            />
            <FeeSpeedTip
              isCustom
              isEIP1559={customFeeInfo?.eip1559}
              price={
                customFeeInfo?.eip1559
                  ? customFeeInfo?.price1559
                  : customFeeInfo?.price
              }
              limit={customFeeInfo?.limit ?? feeInfoPayload?.info.limit ?? '0'}
            />
          </HStack>
        ),
        ...customItemStyle,
      });
    }

    return items;
  }, [gasList, feeInfoPayload?.info, isEIP1559Fee, customFeeInfo]);

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
