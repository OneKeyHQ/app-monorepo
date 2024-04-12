import { memo, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  Badge,
  Button,
  Icon,
  NumberSizeableText,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { SwapProviderIcon } from './SwapProviderIcon';
import SwapRoutePath from './SwapRoutePath';

import type { IListItemProps } from '../../../components/ListItem';

export type ISwapProviderListItemProps = {
  providerResult: IFetchQuoteResult;
  currencySymbol: string;
  fromTokenAmount?: string;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  selected?: boolean;
  disabled?: boolean;
} & IListItemProps;
const SwapProviderListItem = ({
  providerResult,
  currencySymbol,
  fromToken,
  fromTokenAmount,
  toToken,
  selected,
  disabled,
  ...rest
}: ISwapProviderListItemProps) => {
  const networkFeeComponent = useMemo(() => {
    if (providerResult.fee?.estimatedFeeFiatValue) {
      return (
        <XStack py="$0.5" space="$1" alignItems="center">
          <Icon name="GasSolid" size="$4" color="$iconSubdued" />
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{
              currency: currencySymbol,
            }}
          >
            {providerResult.fee.estimatedFeeFiatValue}
          </NumberSizeableText>
        </XStack>
      );
    }
    return null;
  }, [currencySymbol, providerResult.fee?.estimatedFeeFiatValue]);

  const estimatedTimeComponent = useMemo(() => {
    if (providerResult.estimatedTime) {
      const timeInSeconds = new BigNumber(providerResult.estimatedTime);
      const oneMinuteInSeconds = new BigNumber(60);
      let displayTime;
      if (timeInSeconds.isLessThan(oneMinuteInSeconds)) {
        displayTime = '< 1min';
      } else {
        // Divide by 60 and round up to the nearest whole number
        const timeInMinutes = timeInSeconds
          .dividedBy(60)
          .integerValue(BigNumber.ROUND_UP)
          .toNumber();
        displayTime = `${timeInMinutes}min`;
      }
      return (
        <XStack py="$0.5" space="$1" alignItems="center">
          <Icon name="ClockTimeHistoryOutline" size="$4" color="$iconSubdued" />
          <SizableText size="$bodyMd" color="$textSubdued">
            {displayTime}
          </SizableText>
        </XStack>
      );
    }
    return null;
  }, [providerResult.estimatedTime]);

  const protocolFeeComponent = useMemo(() => {
    if (providerResult.fee?.protocolFees) {
      return (
        <XStack py="$0.5" space="$1" alignItems="center">
          <Icon name="HandCoinsOutline" size="$4" color="$iconSubdued" />
          <NumberSizeableText
            size="$bodyMd"
            color="$textSubdued"
            formatter="value"
            formatterOptions={{
              currency: currencySymbol,
            }}
          >
            {providerResult.fee.protocolFees}
          </NumberSizeableText>
        </XStack>
      );
    }
    return null;
  }, [currencySymbol, providerResult.fee?.protocolFees]);

  const leftMainLabel = useMemo(() => {
    if (disabled) {
      return 'Unable to fetch the price';
    }
    if (providerResult.limit) {
      const fromTokenAmountBN = new BigNumber(fromTokenAmount ?? 0);
      if (providerResult.limit.min) {
        const minBN = new BigNumber(providerResult.limit.min);
        if (fromTokenAmountBN.lt(minBN)) {
          return `Min swap amount requires ${minBN.toFixed()} ${
            fromToken?.symbol ?? 'unknown'
          }`;
        }
      }
      if (providerResult.limit.max) {
        const maxBN = new BigNumber(providerResult.limit.max);
        if (fromTokenAmountBN.gt(maxBN)) {
          return `Max swap amount requires ${maxBN.toFixed()} ${
            fromToken?.symbol ?? 'unknown'
          }`;
        }
      }
    }
    if (providerResult.toAmount) {
      return `${
        numberFormat(providerResult.toAmount, {
          formatter: 'balance',
        }) as string
      } ${toToken?.symbol ?? 'unknown'}`;
    }
    return '';
  }, [
    disabled,
    fromToken?.symbol,
    fromTokenAmount,
    providerResult.limit,
    providerResult.toAmount,
    toToken?.symbol,
  ]);

  const [routeOpen, setRouteOpen] = useState(false);

  const routeComponents = useMemo(() => {
    const routesData = providerResult.routesData;
    if (providerResult.info.provider === 'swap_swft') {
      return (
        <SizableText size="$bodySm" color="$textSubdued">
          Please be aware that this transaction is utilizing a third-party
          SWFT_BRIDGE cross-chain bridge, which involves centralized execution
          and carries associated risks.
        </SizableText>
      );
    }
    if (!routesData?.[0]?.subRoutes?.[0]?.length) {
      return (
        <SizableText size="$bodySm" color="$textSubdued">
          The provider does not currently have route information. Your funds are
          safe.
        </SizableText>
      );
    }
    return routesData?.map((route, index) => (
      <SwapRoutePath
        key={index}
        route={route}
        fromToken={fromToken}
        toToken={toToken}
      />
    ));
  }, [
    fromToken,
    providerResult.info.provider,
    providerResult.routesData,
    toToken,
  ]);

  return (
    <YStack
      my="$2"
      space="$3"
      borderRadius="$3"
      opacity={disabled ? 0.5 : 1}
      disabled={disabled}
      hoverStyle={{ borderColor: '$borderHover' }}
      borderWidth="$0.25"
      borderColor={selected ? '$borderActive' : '$borderSubdued'}
      {...rest}
    >
      <XStack
        py="$4"
        px="$3"
        bg="$bgSubdued"
        justifyContent="space-between"
        borderTopRightRadius="$3"
        borderTopLeftRadius="$3"
        {...(!providerResult.toAmount
          ? { borderBottomRightRadius: '$3', borderBottomLeftRadius: '$3' }
          : {})}
      >
        <XStack space="$3">
          <SwapProviderIcon
            providerLogo={providerResult.info.providerLogo}
            lock={!!providerResult.allowanceResult}
          />
          <YStack>
            <XStack space="$1.5" alignItems="center">
              <SizableText color="$text" size="$bodyLgMedium">
                {leftMainLabel}
              </SizableText>
            </XStack>
            <SizableText color="$textSubdued" size="$bodyMdMedium">
              {providerResult.info.providerName}
            </SizableText>
          </YStack>
        </XStack>
        {providerResult.isBest ? (
          <Badge h="$6" badgeType="success" badgeSize="sm">
            Best
          </Badge>
        ) : null}
      </XStack>
      {providerResult.toAmount ? (
        <YStack
          py="$2"
          px="$3"
          space="$3"
          borderBottomRightRadius="$3"
          borderBottomLeftRadius="$3"
        >
          <XStack justifyContent="space-between">
            <XStack space="$2">
              {networkFeeComponent}
              {estimatedTimeComponent}
              {protocolFeeComponent}
            </XStack>
            <Button
              size="small"
              variant="tertiary"
              iconAfter={
                routeOpen ? 'ChevronDownSmallOutline' : 'ChevronRightOutline'
              }
              onPress={() => {
                setRouteOpen((pre) => !pre);
              }}
            >
              Route
            </Button>
          </XStack>

          {routeOpen ? routeComponents : null}
        </YStack>
      ) : null}
    </YStack>
  );
};

export default memo(SwapProviderListItem);
