import type { ComponentProps } from 'react';
import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

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
import type { SvgProps } from 'react-native-svg';

type Props = {
  networkId: string;
  useFormReturn: UseFormReturn<ISendEditFeeValues, any>;
  feeSymbol: string;
  feeInfo?: BlockNativeGasInfo;
  setPriorityBooster?: (value: any) => void;
} & ComponentProps<typeof Box>;

function BlockNativeSvg(props: SvgProps) {
  return (
    <Svg width="82" height="12" viewBox="0 0 82 12" fill="none" {...props}>
      <G clip-path="url(#clip0_5959_37579)">
        <Path
          d="M73.1747 9.04975L71.5645 6.25952H74.7859L76.3975 9.04975H73.1747Z"
          fill="#8C8CA1"
        />
        <Path
          d="M74.7859 6.25952H71.5645L73.1747 3.4693H76.3975L74.7859 6.25952Z"
          fill="#A8A9AC"
        />
        <Path
          d="M78.0077 6.25954L76.3975 3.46931H73.1747L71.5645 0.679077H78.0077L81.2305 6.25954H78.0077Z"
          fill="#8C8CA1"
        />
        <Path
          d="M78.0077 11.84H71.5645L73.1747 9.04975H76.3975L78.0077 6.25952H81.2305L78.0077 11.84Z"
          fill="#A8A9AC"
        />
        <Path
          d="M7.32297 6.8917C7.32297 8.89635 5.84342 10.4438 4.0406 10.4438C3.05835 10.4438 2.34483 10.0804 1.86091 9.4616V10.2554H0.125V0.827331L1.86091 0.292969V4.32285C2.34483 3.70507 3.05835 3.3406 4.0406 3.3406C5.84342 3.3406 7.32297 4.88707 7.32297 6.8917ZM5.58705 6.8917C5.58705 5.75915 4.79425 4.99517 3.7173 4.99517C2.64032 4.99517 1.864 5.76222 1.864 6.8917C1.864 8.02117 2.65782 8.78927 3.7173 8.78927C4.77675 8.78927 5.58705 8.0222 5.58705 6.8917Z"
          fill="#8C8CA1"
        />
        <Path
          d="M8.10352 0.827331L9.83839 0.292969V10.2554H8.10352V0.827331Z"
          fill="#8C8CA1"
        />
        <Path
          d="M10.6057 6.89168C10.6045 6.18735 10.8123 5.4985 11.2029 4.91238C11.5934 4.32623 12.1492 3.8692 12.7997 3.59915C13.4502 3.3291 14.1662 3.25818 14.857 3.39535C15.5479 3.53253 16.1825 3.87165 16.6805 4.36978C17.1784 4.86788 17.5174 5.50258 17.6544 6.19348C17.7913 6.88435 17.7202 7.60035 17.45 8.25078C17.1797 8.90123 16.7225 9.45683 16.1363 9.8472C15.55 10.2376 14.8611 10.4453 14.1568 10.4438C13.689 10.4488 13.2249 10.3603 12.7917 10.1835C12.3586 10.0068 11.9651 9.74528 11.6343 9.41443C11.3036 9.08358 11.0422 8.69 10.8656 8.2568C10.6889 7.8236 10.6006 7.35948 10.6057 6.89168ZM15.9864 6.89168C15.9864 5.80238 15.1926 5.0384 14.1568 5.0384C13.121 5.0384 12.3406 5.80545 12.3406 6.89168C12.3406 7.97793 13.1344 8.74498 14.1568 8.74498C15.1792 8.74498 15.9864 7.98203 15.9864 6.89168Z"
          fill="#8C8CA1"
        />
        <Path
          d="M18.3799 6.89168C18.3799 4.88703 19.8862 3.34058 21.931 3.34058C23.2499 3.34058 24.3928 4.03968 24.9447 5.07545L23.4517 5.95063C23.182 5.39875 22.6033 5.04868 21.9176 5.04868C20.8818 5.04868 20.1148 5.81573 20.1148 6.89168C20.1148 7.9676 20.8818 8.72128 21.9176 8.72128C22.6178 8.72128 23.1954 8.38563 23.462 7.83375L24.9683 8.6945C24.6647 9.23178 24.2224 9.67765 23.6875 9.98553C23.1527 10.2934 22.545 10.4521 21.9279 10.4448C19.8862 10.4438 18.3799 8.8963 18.3799 6.89168Z"
          fill="#8C8CA1"
        />
        <Path
          d="M29.9548 10.2554L27.5065 7.20162V10.2554H25.7705V0.827331L27.5065 0.292969V6.4881L29.819 3.52902H31.8905L29.1878 6.85155L31.9728 10.2554H29.9548Z"
          fill="#8C8CA1"
        />
        <Path
          d="M38.9058 6.12463V10.2554H37.1698V6.3429C37.1698 5.42758 36.619 4.95705 35.8385 4.95705C34.9913 4.95705 34.358 5.45435 34.358 6.625V10.2554H32.623V3.52898H34.358V4.28163C34.7615 3.67623 35.4618 3.34058 36.3628 3.34058C37.7888 3.34058 38.9058 4.34135 38.9058 6.12463Z"
          fill="#8C8CA1"
        />
        <Path
          d="M46.8813 3.52898V10.2554H45.1466V9.46158C44.6616 10.067 43.9356 10.4438 42.9536 10.4438C41.1641 10.4438 39.6846 8.8994 39.6846 6.89168C39.6846 4.88395 41.1641 3.34058 42.9536 3.34058C43.9356 3.34058 44.6616 3.7174 45.1466 4.3228V3.52898H46.8813ZM45.1466 6.89168C45.1466 5.7591 44.3526 4.99515 43.2758 4.99515C42.1988 4.99515 41.4223 5.7622 41.4223 6.89168C41.4223 8.02115 42.2163 8.78923 43.2758 8.78923C44.3351 8.78923 45.1466 8.02218 45.1466 6.89168Z"
          fill="#8C8CA1"
        />
        <Path
          d="M51.404 5.19698V3.52903H49.8833V1.55115L48.1455 2.08551V7.99545C48.1455 9.81168 48.969 10.5241 51.402 10.2606V8.68115C50.4065 8.73573 49.8813 8.72132 49.8813 7.99545V5.19698H51.404Z"
          fill="#8C8CA1"
        />
        <Path
          d="M52.6201 3.52899H54.3551V10.2554H52.6201V3.52899Z"
          fill="#8C8CA1"
        />
        <Path
          d="M62.1613 3.52899L59.6045 10.2554H57.6268L55.0713 3.52899H56.9813L58.609 8.23739L60.2503 3.52899H62.1613Z"
          fill="#8C8CA1"
        />
        <Path
          d="M65.8758 8.87165C66.5481 8.87165 67.0866 8.58955 67.3831 8.19933L68.7813 9.00653C68.1491 9.92083 67.1401 10.448 65.8491 10.448C63.5838 10.448 62.1631 8.90358 62.1631 6.89585C62.1631 4.88813 63.6046 3.34473 65.7141 3.34473C67.7053 3.34473 69.1181 4.919 69.1181 6.89585C69.1153 7.13395 69.0916 7.37135 69.0471 7.60525H63.9793C64.2213 8.49275 64.9616 8.87165 65.8758 8.87165ZM67.3831 6.2616C67.1668 5.29275 66.4411 4.90253 65.7141 4.90253C64.7876 4.90253 64.1543 5.40085 63.9516 6.2616H67.3831Z"
          fill="#8C8CA1"
        />
      </G>
      <Defs>
        <ClipPath id="clip0_5959_37579">
          <Rect width="81.5" height="12" fill="white" />
        </ClipPath>
      </Defs>
    </Svg>
  );
}

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
      <Box
        position="absolute"
        left={0}
        top={0}
        right={0}
        bottom={0}
        zIndex={-1}
      >
        <MotiView
          style={{
            height: '100%',
            backgroundColor: 'surface-neutral-subdued',
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
            duration: FEE_INFO_POLLING_INTERVAL + 100,
            repeatReverse: false,
          }}
        >
          <Box
            position="absolute"
            left={0}
            top={0}
            right={0}
            bottom={0}
            bgColor="surface-neutral-subdued"
          />
        </MotiView>
      </Box>
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
            position="relative"
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

  const intl = useIntl();

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

      <HStack mt={5} alignItems="center" justifyContent="center" space={1}>
        <Text typography="CaptionStrong" color="text-disabled">
          {intl.formatMessage({ id: 'form__powered_by' })}
        </Text>
        <BlockNativeSvg />
      </HStack>
    </Box>
  );
}

export { BlockNativeFeeInfoPanel, BlockNativeSvg };
