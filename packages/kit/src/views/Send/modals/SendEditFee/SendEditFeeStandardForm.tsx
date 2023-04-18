import { useMemo } from 'react';

import { Box, HStack, RadioFee } from '@onekeyhq/components';
import type {
  IFeeInfo,
  IFeeInfoPayload,
  IFeeInfoSelectedType,
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
  paddingTop: '4px',
  paddingBottom: '4px',
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
  currentFeeType: IFeeInfoSelectedType;
};
export function SendEditFeeStandardForm({
  feeInfoPayload,
  value,
  onChange,
  accountId,
  networkId,
  currentCustom,
  currentFeeType,
}: IStandardFeeProps) {
  const customFeeInfo = currentCustom || feeInfoPayload?.selected.custom;
  const isEIP1559Fee = feeInfoPayload?.info?.eip1559;
  const isBtcForkChain = feeInfoPayload?.info?.isBtcForkChain;

  const btcCustomFee = useMemo(() => {
    if (!isBtcForkChain) return null;
    if (currentFeeType !== 'custom') return null;
    if (!currentCustom?.btcFee) return null;
    return `${currentCustom?.btcFee}`;
  }, [currentCustom?.btcFee, currentFeeType, isBtcForkChain]);

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
        btcCustomFee={btcCustomFee}
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
    btcCustomFee,
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
        title: (
          <FeeSpeedLabel
            index={index}
            iconSize={28}
            alignItems="center"
            space={2}
            prices={feeInfoPayload?.info.prices ?? []}
          />
        ),

        describe: (
          <HStack space="10px" alignItems="center">
            <FeeSpeedTime
              index={index}
              waitingSeconds={waitingSeconds}
              prices={feeInfoPayload?.info.prices ?? []}
            />
            <FeeSpeedTip
              index={index}
              isEIP1559={feeInfoPayload?.info.eip1559}
              price={gas}
              limit={feeInfoPayload?.info.limit ?? '0'}
              feeInfo={feeInfoPayload?.info}
            />
          </HStack>
        ),
        ...presetItemStyle,
      };
    });

    if (!feeInfoPayload?.info.customDisabled) {
      items.push({
        value: 'custom',
        title: (
          <FeeSpeedLabel isCustom iconSize={28} alignItems="center" space={2} />
        ),

        describe: (
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
