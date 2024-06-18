import { useMemo } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  Image,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

interface ISwapProviderInfoItemProps {
  rate?: string;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  providerIcon: string;
  showLock?: boolean;
  showBest?: boolean;
  onPress?: () => void;
  isLoading?: boolean;
}
const SwapProviderInfoItem = ({
  showBest,
  rate,
  fromToken,
  toToken,
  providerIcon,
  showLock,
  onPress,
  isLoading,
}: ISwapProviderInfoItemProps) => {
  const intl = useIntl();
  const { md } = useMedia();
  const rateIsExit = useMemo(() => {
    const rateBN = new BigNumber(rate ?? 0);
    return !rateBN.isZero();
  }, [rate]);
  const rateContent = useMemo(() => {
    if (!rateIsExit || !fromToken || !toToken)
      return (
        <SizableText>
          {intl.formatMessage({
            id: ETranslations.swap_page_provider_provider_insufficient_liquidity,
          })}
        </SizableText>
      );
    const rateBN = new BigNumber(rate ?? 0);
    return (
      <SizableText
        size="$bodyMdMedium"
        pl="$1"
        maxWidth={md ? 240 : 360}
        textAlign="right"
      >
        {`1 ${fromToken.symbol.toUpperCase()} = `}
        <NumberSizeableText size="$bodyMdMedium" formatter="balance">
          {rateBN.toFixed()}
        </NumberSizeableText>{' '}
        <SizableText size="$bodyMdMedium">{toToken.symbol}</SizableText>
      </SizableText>
    );
  }, [fromToken, intl, md, rate, rateIsExit, toToken]);
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.swap_page_provider_provider })}
      </SizableText>

      {isLoading ? (
        <Stack py="$1">
          <Skeleton h="$3" w="$24" />
        </Stack>
      ) : (
        <XStack
          alignItems="center"
          userSelect="none"
          hoverStyle={{
            opacity: 0.5,
          }}
          onPress={onPress}
        >
          {showBest ? (
            <Badge badgeType="success" badgeSize="sm" mr="$1">
              Best
            </Badge>
          ) : null}
          {!rateIsExit || !fromToken || !toToken ? null : (
            <Image
              source={{ uri: providerIcon }}
              w="$5"
              h="$5"
              borderRadius="$1"
            />
          )}
          {rateContent}
          {showLock ? (
            <Icon name="LockOutline" color="$iconSubdued" ml="$1" size="$5" />
          ) : null}
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
export default SwapProviderInfoItem;
