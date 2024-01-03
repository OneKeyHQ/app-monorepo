import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Text, XStack, YStack } from '@onekeyhq/components';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/gas';

import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
} from '../../../../utils/gasFee';

type IProps = {
  feeInfo: IFeeInfoUnit;
};

function FeeOverviewContainer(props: IProps) {
  const { feeInfo } = props;

  const intl = useIntl();

  const nativeSymbol = feeInfo.common?.nativeSymbol ?? '';
  const nativeTokenPrice = feeInfo.common?.nativeTokenPrice ?? 0;

  const overview = useMemo(() => {
    let title = '';
    let description = '';
    const { min, max } = calculateTotalFeeRange(feeInfo);
    const totalFeeNative = calculateTotalFeeNative({
      amount: max,
      feeInfo,
    });

    const minFeeNative = calculateTotalFeeNative({
      amount: min,
      feeInfo,
    });
    if (feeInfo.gas || feeInfo.feeUTXO) {
      title = `${totalFeeNative} ${nativeSymbol}`;
      description = new BigNumber(totalFeeNative)
        .multipliedBy(nativeTokenPrice)
        .toFixed(2);
    }

    if (feeInfo.gasEIP1559) {
      title = `${minFeeNative} ${nativeSymbol}`;
      description = `${intl.formatMessage({
        id: 'content__max_fee',
      })}: ${totalFeeNative} ${nativeSymbol}`;
    }

    return {
      title,
      description,
    };
  }, [feeInfo, intl, nativeSymbol, nativeTokenPrice]);

  return (
    <XStack px="$5" paddingBottom="$5" paddingTop="$2">
      <YStack>
        <Text variant="$heading2xl">{overview.title}</Text>
        <Text variant="$bodyMd" color="$textSubdued">
          {overview.description}
        </Text>
      </YStack>
    </XStack>
  );
}

export { FeeOverviewContainer };
