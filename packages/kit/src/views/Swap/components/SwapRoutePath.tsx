import { memo, useMemo } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import type {
  IQuoteRoutePath,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { Token } from '../../../components/Token';

import SwapProviderRouteIconGroup from './SwapProviderRouteIconGroup';

interface ISwapRoutePathProps {
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
  route: IQuoteRoutePath;
}

const DashLine = () => (
  <XStack
    flex={1}
    mb="$6"
    borderColor="$borderSubdued"
    style={{ border: 0, borderTop: '2px dashed' }}
  />
);

const SwapRoutePath = ({ route, fromToken, toToken }: ISwapRoutePathProps) => {
  const pathPart = useMemo(() => {
    if (route.part) {
      return `${route.part}%`;
    }
  }, [route.part]);
  const midComponents = useMemo(() => {
    if (route.subRoutes?.length) {
      return (
        <>
          <DashLine />
          {route.subRoutes.map((subRoute) => (
            <>
              <SwapProviderRouteIconGroup routeInfos={subRoute} />
              <DashLine />
            </>
          ))}
        </>
      );
    }
  }, [route.subRoutes]);
  return (
    <XStack alignItems="center">
      <YStack width="$9" space="$2" height="$14" alignItems="center">
        <Token
          tokenImageUri={fromToken?.logoURI}
          networkImageUri={fromToken?.networkLogoURI}
          size="sm"
        />
        {pathPart ? (
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {pathPart}
          </SizableText>
        ) : null}
      </YStack>
      {midComponents}
      <YStack width="$9" space="$2" height="$14" alignItems="center">
        <Token
          tokenImageUri={toToken?.logoURI}
          networkImageUri={toToken?.networkLogoURI}
          size="sm"
        />
      </YStack>
    </XStack>
  );
};

export default memo(SwapRoutePath);
