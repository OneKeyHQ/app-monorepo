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

  public updateTokenPrice(
    tokenName: string,
    tokenPrice: string,
    tokenLastUpdated: number,
  ) {
    const { lastUpdated = 0 } = this.tokenPriceMap.get(tokenName) || {};
    if (tokenLastUpdated > lastUpdated) {
      this.tokenPriceMap.set(tokenName, {
        price: tokenPrice,
        lastUpdated: tokenLastUpdated,
      });
      (this.priceChangedListenerMap.get(tokenName) || []).forEach((i) => i());
    }
  }

  public getTokenPrice(tokenName: string) {
    return this.tokenPriceMap.get(tokenName)?.price || '-';
  }

  public onPriceChange(tokenName: string, callback: () => void) {
    const listeners = this.priceChangedListenerMap.get(tokenName) || [];
    listeners.push(callback);
    this.priceChangedListenerMap.set(tokenName, listeners);
    return () => {
      const callbacks = this.priceChangedListenerMap.get(tokenName) || [];
      this.priceChangedListenerMap.set(
        tokenName,
        callbacks.filter((i) => i !== callback),
      );
    };
  }
}

const marketTokenPriceEvent = new MarketTokenPriceEvent();

const useTokenPrice = (
  tokenName: string,
  tokenPrice: string,
  tokenLastUpdated: number,
) => {
  const [count, setCount] = useState(0);

  useMemo(() => {
    marketTokenPriceEvent.updateTokenPrice(
      tokenName,
      tokenPrice,
      tokenLastUpdated,
    );
  }, [tokenLastUpdated, tokenName, tokenPrice]);

  useLayoutEffect(() => {
    const removeListener = marketTokenPriceEvent.onPriceChange(
      tokenName,
      () => {
        setCount((i) => i + 1);
      },
    );
    return removeListener;
  }, [tokenLastUpdated, tokenName, tokenPrice]);

  return useMemo(
    () => marketTokenPriceEvent.getTokenPrice(tokenName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tokenName, count],
  );
};

export function MarketTokenPrice({
  price,
  tokenName,
  lastUpdate,
  size,
}: {
  price: string;
  tokenName: string;
  lastUpdate?: string;
  size: ISizableTextProps['size'];
}) {
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;
  const date = useMemo(
    () => (lastUpdate ? new Date(lastUpdate).getTime() : Date.now()),
    [lastUpdate],
  );
  const tokenPrice = useTokenPrice(tokenName, price, date);
  return (
    <NumberSizeableText
      userSelect="none"
      formatter="price"
      size={size}
      formatterOptions={{ currency }}
    >
      {tokenPrice}
    </NumberSizeableText>
  );
}
