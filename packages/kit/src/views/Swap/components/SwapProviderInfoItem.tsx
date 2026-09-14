import { memo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
} from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { UNAVAILABLE_DISPLAY } from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { SwapServiceFeeOverview } from './SwapServiceFeeOverview';

interface ISwapProviderInfoItemProps {
  fromToken?: ISwapToken;
  isBest?: boolean;
  toToken?: ISwapToken;
  providerIcon: string;
  providerName: string;
  onPress?: () => void;
  isLoading?: boolean;
  testID?: string;
  percentageFee?: number;
  percentOriginFee?: number;
  titleProps?: ISizableTextProps;
  valueProps?: ISizableTextProps;
  // Smaller provider logo for tight layouts like Pro mode info rows
  compact?: boolean;
  // Show an '--' placeholder (instead of nothing) while no provider info is
  // available; the row is not pressable in that state
  showEmptyPlaceholder?: boolean;
}

const SwapProviderInfoItemTitleContent = ({
  percentageFee,
  percentOriginFee,
  titleProps,
}: Pick<
  ISwapProviderInfoItemProps,
  'percentageFee' | 'percentOriginFee' | 'titleProps'
>) => {
  const intl = useIntl();

  return (
    <XStack alignItems="center">
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        userSelect="none"
        mr="$1"
        {...titleProps}
      >
        {intl.formatMessage({
          id: ETranslations.swap_page_provider_provider,
        })}
      </SizableText>
      <SwapServiceFeeOverview
        percentageFee={percentageFee}
        percentOriginFee={percentOriginFee}
      />
    </XStack>
  );
};

export const SwapProviderInfoItemTitleContentMemo = memo(
  SwapProviderInfoItemTitleContent,
);

const SwapProviderInfoItem = ({
  fromToken,
  isBest,
  toToken,
  providerIcon,
  providerName,
  onPress,
  isLoading,
  testID,
  percentageFee,
  percentOriginFee,
  titleProps,
  valueProps,
  compact,
  showEmptyPlaceholder,
}: ISwapProviderInfoItemProps) => {
  const intl = useIntl();
  const logoSize = compact ? '$4' : '$5';
  // providerLogo is optional on quotes (and providerName can be absent on
  // malformed ones), so the row counts as empty only when BOTH are missing —
  // a partially-described provider still has a live quote and stays pressable
  const isEmpty = (!providerName && !providerIcon) || !fromToken || !toToken;
  const pressHandler = isEmpty ? undefined : onPress;
  return (
    <XStack testID={testID} justifyContent="space-between" alignItems="center">
      <SwapProviderInfoItemTitleContentMemo
        percentageFee={percentageFee}
        percentOriginFee={percentOriginFee}
        titleProps={titleProps}
      />
      {isLoading ? (
        <Stack py="$1">
          <Skeleton h="$3" w="$24" />
        </Stack>
      ) : (
        <XStack
          alignItems="center"
          userSelect="none"
          hoverStyle={pressHandler ? { opacity: 0.5 } : undefined}
          onPress={pressHandler}
          cursor={pressHandler ? 'pointer' : undefined}
        >
          {isEmpty && showEmptyPlaceholder ? (
            <SizableText size="$bodyMdMedium" {...valueProps}>
              {UNAVAILABLE_DISPLAY}
            </SizableText>
          ) : null}
          {isEmpty ? null : (
            <>
              {isBest ? (
                <Badge badgeSize="sm" badgeType="success" marginRight="$2">
                  {intl.formatMessage({
                    id: ETranslations.global_best,
                  })}
                </Badge>
              ) : null}
              {providerIcon ? (
                <Stack position="relative" w={logoSize} h={logoSize}>
                  <Image
                    source={{ uri: providerIcon }}
                    w={logoSize}
                    h={logoSize}
                    borderRadius="$1"
                  />
                  <Stack
                    position="absolute"
                    top={0}
                    left={0}
                    right={0}
                    bottom={0}
                    borderRadius="$1"
                    borderWidth="$px"
                    borderColor="$borderSubdued"
                    pointerEvents="none"
                  />
                </Stack>
              ) : null}
              <SizableText
                size="$bodyMdMedium"
                ml={providerIcon ? '$1' : undefined}
                {...valueProps}
              >
                {providerName}
              </SizableText>
            </>
          )}
          {pressHandler ? (
            <Icon
              name="ChevronRightSmallOutline"
              size="$5"
              color="$iconSubdued"
              mr="$-1"
            />
          ) : null}
        </XStack>
      )}
    </XStack>
  );
};
export default memo(SwapProviderInfoItem);
