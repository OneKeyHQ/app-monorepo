import { useLayoutEffect, useMemo, useState } from 'react';

import { throttle } from 'lodash';

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
    const cachedData = this.tokenPriceMap.get(cacheKey);
    const { lastUpdated = 0 } = cachedData || {};

    console.log('[PRICE_UPDATE] 💡 MarketTokenPriceEvent.updateTokenPrice:', {
      tokenName,
      tokenSymbol,
      tokenPrice,
      tokenLastUpdated,
      cachedLastUpdated: lastUpdated,
      isNewer: tokenLastUpdated > lastUpdated,
      cacheKey,
    });

    if (tokenLastUpdated > lastUpdated) {
      console.log('[PRICE_UPDATE] 🔄 Price event triggering update for:', {
        tokenName,
        tokenSymbol,
        newPrice: tokenPrice,
        oldPrice: cachedData?.price,
      });

      this.tokenPriceMap.set(cacheKey, {
        price: tokenPrice,
        lastUpdated: tokenLastUpdated,
      });

      const listeners = this.priceChangedListenerMap.get(cacheKey) || [];
      console.log('[PRICE_UPDATE] 📢 Notifying listeners:', {
        tokenName,
        tokenSymbol,
        listenersCount: listeners.length,
      });
      listeners.forEach((i) => i());
    } else {
      console.log('[PRICE_UPDATE] ⏭️ Price event skipped - not newer:', {
        tokenName,
        tokenSymbol,
        tokenLastUpdated,
        cachedLastUpdated: lastUpdated,
      });
    }
  }

  public getTokenPrice(tokenName: string, tokenSymbol: string) {
    const cacheKey = this.buildKey(tokenName, tokenSymbol);
    const cachedData = this.tokenPriceMap.get(cacheKey);
    return cachedData?.price || '-';
  }

  public onPriceChange(
    tokenName: string,
    tokenSymbol: string,
    callback: () => void,
  ) {
    const cacheKey = this.buildKey(tokenName, tokenSymbol);
    const listeners = this.priceChangedListenerMap.get(cacheKey) || [];
    const throttleCallback = throttle(callback, 450);
    listeners.push(throttleCallback);
    this.priceChangedListenerMap.set(cacheKey, listeners);
    return () => {
      const callbacks = this.priceChangedListenerMap.get(cacheKey) || [];
      this.priceChangedListenerMap.set(
        cacheKey,
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
}: {
  name: string;
  symbol: string;
  price: string;
  lastUpdated: number;
}) => {
  const [count, setCount] = useState(0);

  useMemo(() => {
    console.log('[PRICE_UPDATE] 🎯 MarketTokenPrice updating price event:', {
      tokenName,
      tokenSymbol,
      tokenPrice,
      tokenLastUpdated,
      lastUpdatedTime: new Date(tokenLastUpdated).toLocaleTimeString(),
    });

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
  const lastUpdateDate = useMemo(() => {
    const result = lastUpdated ? Number(lastUpdated) : Date.now();
    return result;
  }, [lastUpdated]);

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
