import type { FC } from 'react';
import { Fragment, useCallback, useMemo, useState } from 'react';

import Svg, { Line } from 'react-native-svg';

import {
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import type { IStakeTransactionConfirmation } from '@onekeyhq/shared/types/staking';

import type { LayoutChangeEvent } from 'react-native';

type ISwapRouteItem = NonNullable<
  NonNullable<
    NonNullable<IStakeTransactionConfirmation['transactionDetails']>['data']
  >['swapRoute']
>[number];

type IEarnSwapRouteProps = {
  routes: ISwapRouteItem[];
};

function ConnectorDashedLine() {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const nextWidth = e.nativeEvent.layout.width;
    setWidth((prevWidth) => (prevWidth === nextWidth ? prevWidth : nextWidth));
  }, []);

  return (
    <Stack
      position="absolute"
      left={0}
      right={0}
      top="$2"
      h="$3.5"
      justifyContent="flex-end"
      onLayout={handleLayout}
      pointerEvents="none"
    >
      {width > 0 ? (
        <Svg height={4} width={width}>
          <Line
            x1={0}
            y1={2}
            x2={width}
            y2={2}
            stroke={theme.borderSubdued.val}
            strokeWidth={2}
            strokeDasharray="6 6"
            strokeLinecap="square"
          />
        </Svg>
      ) : null}
    </Stack>
  );
}

function parseConnectorDisplay({
  connectorText,
  priceImpact,
}: {
  connectorText?: string;
  priceImpact?: string;
}) {
  const normalizedText = connectorText?.trim() ?? '';
  const normalizedPriceImpact = priceImpact?.trim();
  if (normalizedPriceImpact) {
    return {
      name: normalizedText,
      impact: normalizedPriceImpact,
    };
  }

  const matched = normalizedText.match(/^(.*?)([+-]?\d+(?:\.\d+)?%)$/);
  if (!matched) {
    return {
      name: normalizedText,
      impact: undefined,
    };
  }

  return {
    name: matched[1].trim(),
    impact: matched[2].trim(),
  };
}

export const EarnSwapRoute: FC<IEarnSwapRouteProps> = ({ routes }) => {
  const routeDisplayData = useMemo(
    () =>
      routes.map((route, index) => {
        const connector =
          index < routes.length - 1 ? route.connector : undefined;
        const parsedConnector = parseConnectorDisplay({
          connectorText: connector?.text?.text,
          priceImpact: connector?.priceImpact,
        });
        return {
          key: `${route.token.symbol}-${index}`,
          route,
          connectorName: parsedConnector.name,
          connectorImpact: parsedConnector.impact,
          hasConnector: !!connector,
        };
      }),
    [routes],
  );
  const hasConnector = routeDisplayData.some((item) => item.hasConnector);

  return (
    <XStack width="100%" alignItems="flex-start" position="relative" py="$2">
      {hasConnector ? <ConnectorDashedLine /> : null}
      {routeDisplayData.map((item) => (
        <Fragment key={item.key}>
          <Image
            width="$6"
            height="$6"
            borderRadius="$full"
            src={item.route.token.logoURI}
          />
          {item.hasConnector ? (
            <YStack flex={1} minWidth={0} alignItems="center" px="$1">
              <YStack alignItems="center" bg="$bgApp" px="$1">
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  textAlign="center"
                  numberOfLines={1}
                >
                  {item.connectorName || ' '}
                </SizableText>
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  textAlign="center"
                  numberOfLines={1}
                >
                  {item.connectorImpact || ' '}
                </SizableText>
              </YStack>
            </YStack>
          ) : null}
        </Fragment>
      ))}
    </XStack>
  );
};
