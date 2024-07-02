import { memo, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Badge,
  HeightTransition,
  Icon,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { SwapProviderIcon } from './SwapProviderIcon';
import SwapRoutePaths from './SwapRoutePaths';

import type { IRouteRows } from './SwapRoutePaths';
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
  const intl = useIntl();
  const networkFeeComponent = useMemo(() => {
    if (providerResult.fee?.estimatedFeeFiatValue) {
      return (
        <XStack space="$1" alignItems="center">
          <Icon name="GasOutline" size="$4" color="$iconSubdued" />
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
        <XStack space="$1" alignItems="center">
          <Icon name="ClockTimeHistoryOutline" size="$4" color="$iconSubdued" />
          <SizableText size="$bodyMd" color="$textSubdued">
            {displayTime}
          </SizableText>
        </XStack>
      );
    }
    return null;
  }, [providerResult.estimatedTime]);

  const protocolFeeComponent = useMemo(
    () => (
      <XStack space="$1" alignItems="center">
        <Icon name="HandCoinsOutline" size="$4" color="$iconSubdued" />
        <NumberSizeableText
          size="$bodyMd"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{
            currency: currencySymbol,
          }}
        >
          {providerResult.fee?.protocolFees ?? 0}
        </NumberSizeableText>
      </XStack>
    ),
    [currencySymbol, providerResult.fee?.protocolFees],
  );

  const leftMainLabel = useMemo(() => {
    if (disabled) {
      return (
        providerResult?.errorMessage ||
        intl.formatMessage({
          id: ETranslations.provider_route_unable_fetch_price,
        })
      );
    }
    if (providerResult.limit) {
      const fromTokenAmountBN = new BigNumber(fromTokenAmount ?? 0);
      if (providerResult.limit.min) {
        const minBN = new BigNumber(providerResult.limit.min);
        if (fromTokenAmountBN.lt(minBN)) {
          return intl.formatMessage(
            { id: ETranslations.provider_min_amount_required },
            {
              amount: numberFormat(providerResult.limit.min, {
                formatter: 'balance',
              }) as string,
              token: fromToken?.symbol ?? 'unknown',
            },
          );
        }
      }
      if (providerResult.limit.max) {
        const maxBN = new BigNumber(providerResult.limit.max);
        if (fromTokenAmountBN.gt(maxBN)) {
          return intl.formatMessage(
            { id: ETranslations.provider_max_amount_required },
            {
              amount: numberFormat(providerResult.limit.max, {
                formatter: 'balance',
              }) as string,
              token: fromToken?.symbol ?? 'unknown',
            },
          );
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
    intl,
    providerResult?.errorMessage,
    providerResult.limit,
    providerResult.toAmount,
    toToken?.symbol,
  ]);

  const [routeOpen, setRouteOpen] = useState(false);

  const routeContent = useMemo<IRouteRows>(() => {
    const routeRows: IRouteRows =
      providerResult.routesData?.map((route) => {
        const fromTokenItem = {
          images: [{ logoImageUri: fromToken?.logoURI }],
          label: route.part ? `${route.part}%` : '',
        };
        const toTokenItem = {
          images: [{ logoImageUri: toToken?.logoURI }],
          label: '',
        };
        const subRoutes =
          route.subRoutes?.map((providers) => {
            let images =
              providers?.map((provider) => ({
                logoImageUri: provider.logo,
              })) ?? [];
            images = images?.length > 3 ? images.slice(0, 3) : images;
            let label = 'protocols';
            if (providers.length === 1) {
              label = providers[0].name;
            }
            return {
              images,
              label,
            };
          }) ?? [];
        return [fromTokenItem, ...subRoutes, toTokenItem];
      }) ?? [];
    return routeRows;
  }, [fromToken?.logoURI, providerResult.routesData, toToken?.logoURI]);

  const routeComponents = useMemo(() => {
    const routesData = providerResult.routesData;
    if (providerResult.info.provider === 'swap_swft') {
      return (
        <SizableText size="$bodySm" color="$textSubdued" mt="$3.5">
          {intl.formatMessage({ id: ETranslations.provider_route_swft })}
        </SizableText>
      );
    }
    if (!routesData?.[0]?.subRoutes?.[0]?.length) {
      return (
        <SizableText size="$bodySm" color="$textSubdued" mt="$3.5">
          {intl.formatMessage({
            id: ETranslations.provider_route_no_information,
          })}
        </SizableText>
      );
    }
    return <SwapRoutePaths routeContent={routeContent} />;
  }, [
    intl,
    providerResult.info.provider,
    providerResult.routesData,
    routeContent,
  ]);

  return (
    <Stack
      role="button"
      group="card"
      borderRadius="$4"
      my="$2"
      overflow="hidden"
      borderCurve="continuous"
      opacity={disabled ? 0.5 : 1}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor={selected ? '$borderActive' : '$borderSubdued'}
      userSelect="none"
      focusStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineOffset: 2,
      }}
      {...rest}
    >
      <XStack
        px="$3.5"
        py="$3"
        bg="$bgSubdued"
        $group-card-hover={{
          bg: '$bgHover',
        }}
        alignItems="center"
      >
        <Stack>
          <SwapProviderIcon
            providerLogo={providerResult.info.providerLogo}
            lock={!!providerResult.allowanceResult}
          />
        </Stack>
        <Stack px="$3" flex={1}>
          <SizableText color="$text" size="$bodyLgMedium">
            {leftMainLabel}
          </SizableText>

          <SizableText color="$textSubdued" size="$bodyMdMedium" pt="$1">
            {providerResult.info.providerName}
          </SizableText>
        </Stack>
        {providerResult.isBest ||
        providerResult.receivedBest ||
        providerResult.minGasCost ? (
          <XStack flexWrap="wrap" justifyContent="flex-end" m={-3} flex={1}>
            {providerResult.isBest ? (
              <Stack p={3}>
                <Badge badgeType="success">
                  {intl.formatMessage({
                    id: ETranslations.provider_label_overall_best,
                  })}
                </Badge>
              </Stack>
            ) : null}
            {providerResult.receivedBest ? (
              <Stack p={3}>
                <Badge badgeType="info">
                  {intl.formatMessage({
                    id: ETranslations.provider_label_max_received,
                  })}
                </Badge>
              </Stack>
            ) : null}
            {providerResult.minGasCost ? (
              <Stack p={3}>
                <Badge badgeType="info">
                  {intl.formatMessage({
                    id: ETranslations.provider_label_min_fee,
                  })}
                </Badge>
              </Stack>
            ) : null}
          </XStack>
        ) : null}
      </XStack>
      {providerResult.toAmount ? (
        <Stack py="$2" px="$3.5">
          <XStack space="$3.5" alignItems="center">
            {networkFeeComponent}
            {estimatedTimeComponent}
            {protocolFeeComponent}
            <XStack
              role="button"
              borderRadius="$2"
              alignItems="center"
              onPress={(e) => {
                setRouteOpen(!routeOpen);
                e.stopPropagation();
              }}
              ml="auto"
              pr="$1"
              my="$-0.5"
              py="$0.5"
              mr="$-1"
              $platform-native={{
                hitSlop: { top: 8, left: 8, right: 8, bottom: 8 },
              }}
              hoverStyle={{
                bg: '$bgHover',
              }}
              pressStyle={{
                bg: '$bgActive',
              }}
              focusStyle={{
                outlineWidth: 2,
                outlineColor: '$focusRing',
                outlineStyle: 'solid',
              }}
            >
              <SizableText pl="$2" size="$bodySmMedium" color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.provider_route })}
              </SizableText>
              <MotiView
                {...(routeOpen
                  ? {
                      from: {
                        rotate: '0deg',
                      },
                      animate: {
                        rotate: '90deg',
                      },
                    }
                  : {
                      from: {
                        rotate: '90deg',
                      },
                      animate: {
                        rotate: '0deg',
                      },
                    })}
                transition={{
                  type: 'timing',
                  duration: 150,
                }}
              >
                <Icon
                  name="ChevronRightSmallOutline"
                  size="$5"
                  color="$iconSubdued"
                />
              </MotiView>
            </XStack>
          </XStack>
          <HeightTransition>
            {routeOpen ? routeComponents : null}
          </HeightTransition>
        </Stack>
      ) : null}
    </Stack>
  );
};

export default memo(SwapProviderListItem);
