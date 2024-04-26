import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Box, Text } from '@onekeyhq/components';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type {
  IFeeInfo,
  IFeeInfoPrice,
} from '@onekeyhq/engine/src/vaults/types';
import {
  calculateTotalFeeNative,
  calculateTotalFeeRange,
} from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';

import { FormatCurrencyNativeOfAccount } from '../../../components/Format';

type Props = {
  accountId: string;
  networkId: string;
  feeInfo?: IFeeInfo;
  price?: IFeeInfoPrice;
  limit?: string;
  btcCustomFee?: string | null;
  onlyCurrency?: boolean;
  currencyProps?: ComponentProps<typeof Text>;
  formatOptions?: ComponentProps<
    typeof FormatCurrencyNativeOfAccount
  >['formatOptions'];
};

function SendEditFeeOverview(props: Props) {
  const {
    accountId,
    networkId,
    feeInfo,
    price,
    limit,
    btcCustomFee,
    onlyCurrency,
    currencyProps,
    formatOptions,
  } = props;

  const intl = useIntl();

  const isEIP1559Fee = feeInfo?.eip1559;
  const isBtcForkChain = feeInfo?.isBtcForkChain;

  let minFeeNative = '';
  let totalFeeNative = '';
  const displayDecimal = feeInfo?.feeDecimals;
  if (feeInfo) {
    if (isEIP1559Fee) {
      const { min, max } = calculateTotalFeeRange(
        {
          eip1559: true,
          limit,
          price1559: price as EIP1559Fee,
        },
        displayDecimal,
      );
      const minFee = min;
      totalFeeNative = calculateTotalFeeNative({
        amount: max,
        info: feeInfo,
      });

      minFeeNative = calculateTotalFeeNative({
        amount: minFee,
        info: feeInfo,
      });
    } else if (isBtcForkChain) {
      let btcFee;
      if (btcCustomFee) {
        btcFee = parseInt(btcCustomFee);
      } else {
        const priceIndex = feeInfo.prices.findIndex((i) => i === price);
        btcFee = feeInfo.feeList?.[priceIndex];
      }
      const totalFee = calculateTotalFeeRange(
        {
          limit,
          price: price as string,
          btcFee,
          isBtcForkChain: true,
        },
        displayDecimal,
      ).max;
      totalFeeNative = calculateTotalFeeNative({
        amount: totalFee,
        info: feeInfo,
        displayDecimal,
      });
    } else {
      const totalFee = calculateTotalFeeRange(
        {
          limit,
          price: price as string,
        },
        displayDecimal,
      ).max;
      totalFeeNative = calculateTotalFeeNative({
        amount: totalFee,
        info: feeInfo,
        displayDecimal,
      });
    }
  }

  if (onlyCurrency) {
    return (
      <Text {...currencyProps}>
        {minFeeNative ? (
          <FormatCurrencyNativeOfAccount
            accountId={accountId}
            networkId={networkId}
            value={minFeeNative}
            formatOptions={formatOptions}
            render={(ele) => <>{!minFeeNative ? '-' : ele}</>}
          />
        ) : (
          <FormatCurrencyNativeOfAccount
            accountId={accountId}
            networkId={networkId}
            value={totalFeeNative}
            formatOptions={formatOptions}
            render={(ele) => <>{!totalFeeNative ? '-' : ele}</>}
          />
        )}
      </Text>
    );
  }

  if (!feeInfo) return null;

  return (
    <Box>
      <Text typography="Body2Strong" textAlign="center">
        {minFeeNative || totalFeeNative}
        {feeInfo?.nativeSymbol ?? ''}
      </Text>
      <Text typography="Display2XLarge" textAlign="center">
        {minFeeNative ? (
          <FormatCurrencyNativeOfAccount
            accountId={accountId}
            networkId={networkId}
            value={minFeeNative}
            formatOptions={formatOptions}
            render={(ele) => <>{!minFeeNative ? '-' : ele}</>}
          />
        ) : (
          <FormatCurrencyNativeOfAccount
            accountId={accountId}
            networkId={networkId}
            value={totalFeeNative}
            formatOptions={formatOptions}
            render={(ele) => <>{!totalFeeNative ? '-' : ele}</>}
          />
        )}
      </Text>
      {minFeeNative && (
        <Text typography="Body2" color="text-subdued" textAlign="center" mt={1}>
          {intl.formatMessage({ id: 'content__max_fee' })}:
          <FormatCurrencyNativeOfAccount
            accountId={accountId}
            networkId={networkId}
            value={totalFeeNative}
            formatOptions={formatOptions}
            render={(ele) => <>{!totalFeeNative ? '-' : ele}</>}
          />
          {`(${totalFeeNative}${feeInfo?.nativeSymbol ?? ''})`}
        </Text>
      )}
    </Box>
  );
}

export { SendEditFeeOverview };
