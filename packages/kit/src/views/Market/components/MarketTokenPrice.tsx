import { useLayoutEffect, useMemo, useState } from 'react';

import { throttle } from 'lodash';

import type { ISizableTextProps } from '@onekeyhq/components';
import { NumberSizeableText } from '@onekeyhq/components';

class MarketTokenPriceEvent {
  private tokenPriceMap = new Map<
    string,
    {
      price: string;
      lastUpdated: number;
    }
  >();

  private priceChangedListenerMap = new Map<string, (() => void)[]>();

  private buildKey(name: string, symbol: string, cacheKey?: string) {
    return cacheKey ?? `${name}-${symbol}`;
  }

  public updateTokenPrice({
    name: tokenName,
    symbol: tokenSymbol,
    price: tokenPrice,
    lastUpdated: tokenLastUpdated,
    cacheKey,
  }: {
    name: string;
    symbol: string;
    price: string;
    lastUpdated: number;
    cacheKey?: string;
  }) {
    const priceCacheKey = this.buildKey(tokenName, tokenSymbol, cacheKey);
    const cachedData = this.tokenPriceMap.get(priceCacheKey);
    const { lastUpdated = 0 } = cachedData || {};

    if (tokenLastUpdated > lastUpdated) {
      this.tokenPriceMap.set(priceCacheKey, {
        price: tokenPrice,
        lastUpdated: tokenLastUpdated,
      });

      const listeners = this.priceChangedListenerMap.get(priceCacheKey) || [];
      listeners.forEach((i) => i());
    }
  }

  public getTokenPrice(
    tokenName: string,
    tokenSymbol: string,
    cacheKey?: string,
  ) {
    const priceCacheKey = this.buildKey(tokenName, tokenSymbol, cacheKey);
    const cachedData = this.tokenPriceMap.get(priceCacheKey);
    const price = cachedData?.price || '-';

    return price;
  }

  public onPriceChange(
    tokenName: string,
    tokenSymbol: string,
    callback: () => void,
    cacheKey?: string,
  ) {
    const priceCacheKey = this.buildKey(tokenName, tokenSymbol, cacheKey);
    const listeners = this.priceChangedListenerMap.get(priceCacheKey) || [];
    const throttleCallback = throttle(callback, 450);
    listeners.push(throttleCallback);
    this.priceChangedListenerMap.set(priceCacheKey, listeners);
    return () => {
      const callbacks = this.priceChangedListenerMap.get(priceCacheKey) || [];
      this.priceChangedListenerMap.set(
        priceCacheKey,
        callbacks.filter((i) => i !== throttleCallback),
      );
    };
  }
}

const marketTokenPriceEvent = new MarketTokenPriceEvent();

export const useTokenPrice = ({
  name: tokenName,
  symbol: tokenSymbol,
  price: tokenPrice,
  lastUpdated: tokenLastUpdated,
  cacheKey,
}: {
  name: string;
  symbol: string;
  price: string;
  lastUpdated: number;
  cacheKey?: string;
}) => {
  const [count, setCount] = useState(0);

  useMemo(() => {
    marketTokenPriceEvent.updateTokenPrice({
      name: tokenName,
      symbol: tokenSymbol,
      price: tokenPrice,
      lastUpdated: tokenLastUpdated,
      cacheKey,
    });
  }, [cacheKey, tokenLastUpdated, tokenName, tokenPrice, tokenSymbol]);

  useLayoutEffect(() => {
    const removeListener = marketTokenPriceEvent.onPriceChange(
      tokenName,
      tokenSymbol,
      () => {
        setCount((i) => i + 1);
      },
      cacheKey,
    );

    return () => {
      removeListener();
    };
  }, [cacheKey, tokenLastUpdated, tokenName, tokenPrice, tokenSymbol]);

  return useMemo(
    () => {
      const price = marketTokenPriceEvent.getTokenPrice(
        tokenName,
        tokenSymbol,
        cacheKey,
      );
      return price;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey, tokenName, tokenSymbol, count],
  );
};

export function MarketTokenPrice({
  price,
  tokenName,
  tokenSymbol,
  lastUpdated,
  cacheKey,
  size,
  ...props
}: {
  price: string;
  tokenSymbol: string;
  tokenName: string;
  lastUpdated?: string;
  cacheKey?: string;
} & ISizableTextProps) {
  const lastUpdateDate = useMemo(() => {
    if (
      typeof lastUpdated === 'string' &&
      lastUpdated.length === '1757498100000'.length
    ) {
      return Number(lastUpdated);
    }

    return lastUpdated ? new Date(lastUpdated).getTime() : Date.now();
  }, [lastUpdated]);

  const tokenPrice = useTokenPrice({
    name: tokenName,
    price,
    symbol: tokenSymbol,
    lastUpdated: lastUpdateDate,
    cacheKey,
  });

  return (
    <NumberSizeableText
      userSelect="none"
      formatter="price"
      size={size}
      formatterOptions={{ currency: '$' }}
      {...props}
    >
      {tokenPrice}
    </NumberSizeableText>
  );
}

export function BaseMarketTokenPrice({
  price,
  tokenName,
  tokenSymbol,
  lastUpdated,
  size,
  currency = '$',
  ...props
}: {
  price: string;
  tokenSymbol: string;
  tokenName: string;
  lastUpdated?: string;
  currency?: string;
} & ISizableTextProps) {
  return (
    <NumberSizeableText
      userSelect="none"
      formatter="price"
      size={size}
      formatterOptions={{ currency }}
      {...props}
    >
      {price}
    </NumberSizeableText>
  );
}
