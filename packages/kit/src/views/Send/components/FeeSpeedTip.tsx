/* eslint-disable react/no-unstable-nested-components */
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Box, HStack, Icon, RichTooltip, Text } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';
import type {
  IFeeInfo,
  IFeeInfoPrice,
  IFeeInfoUnit,
} from '@onekeyhq/engine/src/vaults/types';

function FeeInfoItem({ title, value }: { title: string; value: string }) {
  return (
    <HStack justifyContent="space-between">
      <Text typography="Body2Strong">{title}</Text>
      <Text typography="Body2" color="text-subdued">
        {value}
      </Text>
    </HStack>
  );
}

export function FeeSpeedTip({
  index,
  isCustom,
  isEIP1559,
  price,
  limit,
  feeInfo,
  prices,
  custom,
}: {
  index?: number | string;
  isCustom?: boolean;
  isEIP1559?: boolean;
  price?: IFeeInfoPrice;
  limit?: string;
  feeInfo?: IFeeInfo;
  prices?: IFeeInfoPrice[];
  custom?: IFeeInfoUnit;
}) {
  const intl = useIntl();
  const indexInt = parseInt(index as string, 10);

  let feeSpeedTipId: LocaleIds;

  if (isCustom) {
    feeSpeedTipId = 'content__gas_option_custom_desc';
  } else if (prices?.length === 1) {
    feeSpeedTipId = 'content__gas_option_market_desc';
  } else {
    switch (indexInt) {
      case 0:
        feeSpeedTipId = 'content__gas_option_low_desc';
        break;
      case 1:
        feeSpeedTipId = 'content__gas_option_market_desc';
        break;
      case 2:
        feeSpeedTipId = 'content__gas_option_aggressive_desc';
        break;
      default:
        feeSpeedTipId = 'content__gas_option_market_desc';
    }
  }

  const isBtcForkChain = feeInfo?.isBtcForkChain;

  return (
    <RichTooltip
      trigger={({ ...props }) => (
        <Pressable {...props}>
          <Icon name="InformationCircleMini" size={18} color="icon-subdued" />
        </Pressable>
      )}
      bodyProps={{
        children: (
          <Box>
            <Text typography="Body2">
              {intl.formatMessage({ id: feeSpeedTipId })}
            </Text>
            {isEIP1559 && price && limit && (
              <Box mt={1}>
                <FeeInfoItem
                  title={intl.formatMessage({ id: 'content__max_fee' })}
                  value={(price as EIP1559Fee).maxFeePerGas}
                />
                <FeeInfoItem
                  title={intl.formatMessage({
                    id: 'content__max_priority_fee',
                  })}
                  value={(price as EIP1559Fee).maxPriorityFeePerGas}
                />
                <FeeInfoItem
                  title={intl.formatMessage({ id: 'content__gas_limit' })}
                  value={new BigNumber(limit).toFixed()}
                />
              </Box>
            )}
            {!isEIP1559 && !isBtcForkChain && price && limit && (
              <Box mt={1}>
                <FeeInfoItem
                  title={intl.formatMessage({ id: 'content__gas_price' })}
                  value={price as string}
                />
                <FeeInfoItem
                  title={intl.formatMessage({ id: 'content__gas_limit' })}
                  value={new BigNumber(limit).toFixed()}
                />
              </Box>
            )}
            {isBtcForkChain && price && limit && (
              <Box mt={1}>
                <FeeInfoItem
                  title={intl.formatMessage({ id: 'form__fee_rate' })}
                  value={
                    isCustom && custom?.feeRate
                      ? `${custom.feeRate} sat/vB`
                      : `${new BigNumber(price as string)
                          .shiftedBy(feeInfo?.feeDecimals ?? 8)
                          .toFixed()} sat/vB`
                  }
                />
                <FeeInfoItem
                  title={intl.formatMessage({ id: 'form__size' })}
                  value={`${limit} B`}
                />
              </Box>
            )}
          </Box>
        ),
      }}
    />
  );
}
