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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { SwapServiceFeeOverview } from './SwapServiceFeeOverview';

interface ISwapProviderInfoItemProps {
  fromToken?: ISwapToken;
  isBest?: boolean;
  toToken?: ISwapToken;
  providerIcon: string;
  providerName: string;
  showLock?: boolean;
  onPress?: () => void;
  isLoading?: boolean;
  testID?: string;
  percentageFee?: number;
  percentOriginFee?: number;
}

const SwapProviderInfoItemTitleContent = ({
  percentageFee,
  percentOriginFee,
}: Pick<ISwapProviderInfoItemProps, 'percentageFee' | 'percentOriginFee'>) => {
  const intl = useIntl();

  return (
    <XStack alignItems="center">
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        userSelect="none"
        mr="$1"
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
  showLock: _showLock,
  onPress,
  isLoading,
  testID,
  percentageFee,
  percentOriginFee,
}: ISwapProviderInfoItemProps) => {
  const intl = useIntl();
  return (
    <XStack testID={testID} justifyContent="space-between" alignItems="center">
      <SwapProviderInfoItemTitleContentMemo
        percentageFee={percentageFee}
        percentOriginFee={percentOriginFee}
      />
      {isLoading ? (
        <Stack py="$1">
          <Skeleton h="$3" w="$24" />
        </Stack>
      ) : (
        <XStack
          alignItems="center"
          userSelect="none"
          hoverStyle={onPress ? { opacity: 0.5 } : undefined}
          onPress={onPress}
          cursor={onPress ? 'pointer' : undefined}
        >
          {!providerIcon || !fromToken || !toToken ? null : (
            <>
              {isBest ? (
                <Badge badgeSize="sm" badgeType="success" marginRight="$2">
                  {intl.formatMessage({
                    id: ETranslations.global_best,
                  })}
                </Badge>
              ) : null}
              <Stack position="relative" w="$5" h="$5">
                <Image
                  source={{ uri: providerIcon }}
                  w="$5"
                  h="$5"
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
              <SizableText size="$bodyMdMedium" ml="$1">
                {providerName ?? ''}
              </SizableText>
            </>
          )}
          {onPress ? (
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
