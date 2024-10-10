import { useLayoutEffect, useMemo, useState } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { NumberSizeableText } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

class MarketTokenPriceEvent {
  private tokenPriceMap = new Map<
    string,
    {
      price: string;
      lastUpdated: number;
    }
  >();

  private priceChangedListenerMap = new Map<string, (() => void)[]>();

  private buildKey(name: string, symbol: string) {
    return `${name}-${symbol}`;
  }

  public updateTokenPrice({
    name: tokenName,
    symbol: tokenSymbol,
    price: tokenPrice,
    lastUpdated: tokenLastUpdated,
  }: {
    name: string;
    symbol: string;
    price: string;
    lastUpdated: number;
  }) {
    const cacheKey = this.buildKey(tokenName, tokenSymbol);
    const { lastUpdated = 0 } = this.tokenPriceMap.get(tokenName) || {};
    if (tokenLastUpdated > lastUpdated) {
      this.tokenPriceMap.set(cacheKey, {
        price: tokenPrice,
        lastUpdated: tokenLastUpdated,
      });
      (this.priceChangedListenerMap.get(cacheKey) || []).forEach((i) => i());
    }
  }

  public getTokenPrice(tokenName: string, tokenSymbol: string) {
    const cacheKey = this.buildKey(tokenName, tokenSymbol);
    return this.tokenPriceMap.get(cacheKey)?.price || '-';
  }

  public onPriceChange(
    tokenName: string,
    tokenSymbol: string,
    callback: () => void,
  ) {
    const cacheKey = this.buildKey(tokenName, tokenSymbol);
    const listeners = this.priceChangedListenerMap.get(cacheKey) || [];
    listeners.push(callback);
    this.priceChangedListenerMap.set(cacheKey, listeners);
    return () => {
      const callbacks = this.priceChangedListenerMap.get(cacheKey) || [];
      this.priceChangedListenerMap.set(
        cacheKey,
        callbacks.filter((i) => i !== callback),
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
}: {
  name: string;
  symbol: string;
  price: string;
  lastUpdated: number;
}) => {
  const [count, setCount] = useState(0);

  useMemo(() => {
    marketTokenPriceEvent.updateTokenPrice({
      name: tokenName,
      symbol: tokenSymbol,
      price: tokenPrice,
      lastUpdated: tokenLastUpdated,
    });
  }, [tokenLastUpdated, tokenName, tokenPrice, tokenSymbol]);

  useLayoutEffect(() => {
    const removeListener = marketTokenPriceEvent.onPriceChange(
      tokenName,
      tokenSymbol,
      () => {
        setCount((i) => i + 1);
      },
    );
    return removeListener;
  }, [tokenLastUpdated, tokenName, tokenPrice, tokenSymbol]);

  return useMemo(
    () => marketTokenPriceEvent.getTokenPrice(tokenName, tokenSymbol),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tokenName, tokenSymbol, count],
  );
};

export function MarketTokenPrice({
  price,
  tokenName,
  tokenSymbol,
  lastUpdated,
  size,
  ...props
}: {
  price: string;
  tokenSymbol: string;
  tokenName: string;
  lastUpdated?: string;
} & ISizableTextProps) {
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const lastUpdateDate = useMemo(
    () => (lastUpdated ? new Date(lastUpdated).getTime() : Date.now()),
    [lastUpdated],
  );
  const tokenPrice = useTokenPrice({
    name: tokenName,
    price,
    symbol: tokenSymbol,
    lastUpdated: lastUpdateDate,
  });
  return (
    <NumberSizeableText
      userSelect="none"
      formatter="price"
      size={size}
      formatterOptions={{ currency }}
      {...props}
    >
      {tokenPrice}
    </NumberSizeableText>
  );
}
