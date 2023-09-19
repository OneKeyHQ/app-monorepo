import { useMemo } from 'react';

import { intersection } from 'lodash';

import { useAppSelector } from '../../../../hooks';

const CDefaultPopular = ['usd', 'eur', 'gbp', 'jpy', 'cny', 'hkd'];
const CDefaultCrypto = ['btc', 'eth', 'sats', 'bits'];

export const useCurrencyData = (key: string) => {
  const fiatMoneyMap = useAppSelector((s) => s.fiatMoney.map);
  return useMemo(() => fiatMoneyMap[key] ?? {}, [fiatMoneyMap, key]);
};

export const useCurrencyListData = () => {
  const symbolList = useAppSelector((s) => s.fiatMoney.symbolList);
  const fiatMoneyMap = useAppSelector((s) => s.fiatMoney.map);
  const popularList = intersection(CDefaultPopular, symbolList);
  const crypto = intersection(CDefaultCrypto, symbolList);
  const ratesSectionList = [
    { title: 'crypto', data: [...crypto] },
    {
      title: 'fiat',
      data: symbolList.filter((item) =>
        fiatMoneyMap[item]?.type?.includes('fiat'),
      ),
    },
  ];
  return { popularList, ratesSectionList };
};

export const useCurrencyUnit = (key: string) => {
  const { unit } = useCurrencyData(key);
  return useMemo(() => unit ?? '$', [unit]);
};
