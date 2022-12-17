import { useMemo } from 'react';

import { RadioFee } from '@onekeyhq/components';
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
  const gasList = useMemo(
    () => feeInfoPayload?.info?.prices ?? [],
    [feeInfoPayload?.info?.prices],
  );
  const gasItems = useMemo(() => {
    if (!gasList) return [];
    const isEIP1559Fee = feeInfoPayload?.info?.eip1559;
    if (isEIP1559Fee) {
      return gasList.map((gas, index) => {
        // const gasInfo = gas as EIP1559Fee;
        const { min, max } = calculateTotalFeeRange({
          eip1559: true,
          limit: feeInfoPayload?.info?.limit,
          price: gas,
        });
        const minFee = min;
        const totalFeeNative = calculateTotalFeeNative({
          amount: max,
          info: feeInfoPayload?.info,
        });

        const minFeeNative = calculateTotalFeeNative({
          amount: minFee,
          info: feeInfoPayload?.info,
        });

        const waitingSeconds = feeInfoPayload?.info.waitingSeconds?.[index];

        return {
          value: index.toString(),
          title: <FeeSpeedLabel index={index} />,
          titleSecond: (
            <FeeSpeedTime index={index} waitingSeconds={waitingSeconds} />
          ),
          describe: (
            <FormatCurrencyNativeOfAccount
              accountId={accountId}
              networkId={networkId}
              value={minFeeNative}
              render={(ele) => <>~ {!minFeeNative ? '-' : ele}</>}
            />
          ),
          describeSecond: (
            <FormatCurrencyNativeOfAccount
              accountId={accountId}
              networkId={networkId}
              value={totalFeeNative}
              render={(ele) => <>Max Fee: {!totalFeeNative ? '-' : ele}</>}
            />
          ),
          describeThird: `${totalFeeNative}${
            feeInfoPayload.info.nativeSymbol ?? ''
          }`,
        };
      });
    }

    return gasList.map((gas, index) => {
      const totalFee = calculateTotalFeeRange({
        limit: feeInfoPayload?.info?.limit,
        price: gas,
      }).max;
      const totalFeeNative = calculateTotalFeeNative({
        amount: totalFee,
        info: feeInfoPayload?.info as IFeeInfo,
      });
      const waitingSeconds = (feeInfoPayload?.info as IFeeInfo)
        .waitingSeconds?.[index];

      return {
        value: index.toString(),
        title: <FeeSpeedLabel index={index} />,
        titleSecond: (
          <FeeSpeedTime index={index} waitingSeconds={waitingSeconds} />
        ),
        describe: (
          <FormatCurrencyNativeOfAccount
            accountId={accountId}
            networkId={networkId}
            value={totalFeeNative}
            render={(ele) => <>~ {!totalFeeNative ? '-' : ele}</>}
          />
        ),
        describeSecond: `${totalFeeNative}${
          feeInfoPayload?.info?.nativeSymbol
            ? ` ${feeInfoPayload?.info?.nativeSymbol}`
            : ''
        }`,
      };
    });
  }, [accountId, feeInfoPayload?.info, gasList, networkId]);

  return (
    <RadioFee
      padding="0px"
      mt={5}
      items={gasItems}
      name="standard fee group"
      value={value}
      onChange={onChange}
    />
  );
}
