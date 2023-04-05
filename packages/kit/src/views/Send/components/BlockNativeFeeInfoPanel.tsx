import type { ComponentProps } from 'react';
import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';

import { Box, HStack, Text, Tooltip, VStack } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';
import type { BlockNativeGasInfo } from '@onekeyhq/engine/src/types/blockNative';
import type { EIP1559Fee } from '@onekeyhq/engine/src/types/network';

import { getConfidenceInfoLevel } from '../utils/getConfidenceInfoLevel';
import {
  FEE_INFO_POLLING_INTERVAL,
  FEE_LEVEL_TEXT_COLOR_MAP,
} from '../utils/sendConfirmConsts';

import { LabelWithTooltip } from './LableWithTooltip';

import type { ISendEditFeeValues } from '../types';
import type { UseFormReturn } from 'react-hook-form';

type Props = {
  networkId: string;
  useFormReturn: UseFormReturn<ISendEditFeeValues, any>;
  feeSymbol: string;
  feeInfo?: BlockNativeGasInfo;
  setPriorityBooster?: (value: any) => void;
} & ComponentProps<typeof Box>;

function BlockNativeFeeInfoItem({
  price,
  useFormReturn,
  setPriorityBooster,
}: {
  price: EIP1559Fee;
  useFormReturn: UseFormReturn<ISendEditFeeValues, any>;
  setPriorityBooster?: (value: any) => void;
}) {
  const intl = useIntl();
  const { setValue } = useFormReturn;

  const progress = useMemo(
    () => (
      <MotiView
        style={{
          height: '100%',
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: -1,
        }}
        from={{
          width: '0%',
        }}
        animate={{
          width: '100%',
        }}
        transition={{
          loop: true,
          type: 'timing',
          duration: FEE_INFO_POLLING_INTERVAL + 500,
          repeatReverse: false,
        }}
      >
        <Box
          position="absolute"
          left={0}
          top={0}
          right={0}
          bottom={0}
          bg="surface-neutral-subdued"
        />
      </MotiView>
    ),
    [],
  );

  if (!price) return null;

  const { confidence, baseFee, maxFeePerGas, maxPriorityFeePerGas } = price;

  return (
    <Pressable
      flexBasis="49%"
      onPress={() => {
        setPriorityBooster?.(1);
        setValue('baseFee', baseFee);
        setValue('maxFeePerGas', maxFeePerGas);
        setValue('maxPriorityFeePerGas', maxPriorityFeePerGas);
      }}
    >
      {(status) => {
        let bgColor: string | undefined;
        bgColor = 'action-secondary-default';
        if (status.isPressed) {
          bgColor = 'surface-pressed';
        }
        if (status.isHovered) {
          bgColor = 'surface-hovered';
        }
        return (
          <Box
            px={4}
            py={2}
            bg={bgColor}
            alignItems="flex-start"
            justifyContent="center"
            borderRadius="12px"
            overflow="hidden"
          >
            {progress}
            <Text
              typography="Body2Strong"
              color={
                FEE_LEVEL_TEXT_COLOR_MAP[
                  getConfidenceInfoLevel(confidence ?? 0)
                ]
              }
            >
              {intl.formatMessage(
                { id: 'form__str_probability' },
                { 0: `${confidence ?? 0}%` },
              )}
            </Text>
            <HStack w="full" justifyContent="space-between">
              <VStack flexBasis="50%">
                <Text typography="Caption" color="text-subdued">
                  {intl.formatMessage({ id: 'form__priority_fee' })}
                </Text>
                <Text typography="Heading">{maxPriorityFeePerGas}</Text>
              </VStack>
              <VStack flexBasis="48%">
                <Text typography="Caption" color="text-subdued">
                  {intl.formatMessage({ id: 'form__max_fee' })}
                </Text>
                <Text typography="Heading">{maxFeePerGas}</Text>
              </VStack>
            </HStack>
          </Box>
        );
      }}
    </Pressable>
  );
}

function BlockNativeOverviewItem({
  titleId,
  tooltipId,
  value,
  ...props
}: {
  titleId: LocaleIds;
  tooltipId: LocaleIds;
  value?: string;
} & ComponentProps<typeof Pressable>) {
  const intl = useIntl();

  return (
    <Tooltip
      maxWidth="260px"
      placement="top"
      hasArrow
      label={intl.formatMessage({ id: tooltipId })}
    >
      <Pressable {...props}>
        <Text color="text-disabled" textAlign="center" fontSize="12px">
          {intl.formatMessage({ id: titleId })}
        </Text>
        <Text typography="DisplaySmall" textAlign="center" fontSize="16px">
          {value}
        </Text>
      </Pressable>
    </Tooltip>
  );
}

function BlockNativeFeeInfoPanel(props: Props) {
  const { useFormReturn, feeInfo, setPriorityBooster, feeSymbol, ...rest } =
    props;

  const priceBlocks = useMemo(() => {
    if (!feeInfo?.prices.length) return null;
    const blocks = [];
    for (let i = 0, len = feeInfo?.prices.length; i < len; i += 2) {
      if (i % 2 === 0) {
        blocks.push(
          <HStack mt={2} justifyContent="space-between">
            <BlockNativeFeeInfoItem
              price={feeInfo?.prices[i]}
              useFormReturn={useFormReturn}
              setPriorityBooster={setPriorityBooster}
            />
            <BlockNativeFeeInfoItem
              price={feeInfo?.prices[i + 1]}
              useFormReturn={useFormReturn}
              setPriorityBooster={setPriorityBooster}
            />
          </HStack>,
        );
      }
    }

    return blocks;
  }, [feeInfo?.prices, setPriorityBooster, useFormReturn]);

  return (
    <Box {...rest}>
      <LabelWithTooltip
        labelId="form__gas_fee_prediction"
        tooltipId="content__custom_gas_fee_prediction_desc"
      />
      {priceBlocks}
      <HStack mt={4} justifyContent="center">
        <BlockNativeOverviewItem
          titleId="form__base_fee"
          tooltipId="content__custom_what_is_base_fee_desc"
          value={`${new BigNumber(feeInfo?.baseFee ?? 0).toFixed(
            2,
          )} ${feeSymbol}`}
          paddingRight={4}
        />
        <BlockNativeOverviewItem
          titleId="form__max_gas_price"
          tooltipId="content__custom_what_is_max_gas_price_desc"
          value={`${feeInfo?.maxPrice ?? 0} ${feeSymbol}`}
          paddingX={4}
          borderLeftWidth={1}
          borderRightWidth={1}
          borderColor="border-default"
        />
        <BlockNativeOverviewItem
          titleId="form__pending_tx"
          value={String(feeInfo?.estimatedTransactionCount ?? 0)}
          tooltipId="content__custom_what_is_pending_tx_desc"
          paddingLeft={4}
        />
      </HStack>
    </Box>
  );
}

export { BlockNativeFeeInfoPanel };
