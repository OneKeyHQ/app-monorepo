import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { useCurrencyPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type {
  ICurrencyItem,
  ICurrencyType,
} from '../views/Setting/pages/Currency';

const currencyFilterFn = (keyword: string, item: ICurrencyItem) => {
  const text = keyword.toLowerCase();
  return (
    item.id.toLowerCase().includes(text) ||
    item.name.toLowerCase().includes(text)
  );
};

export const useCurrencySections = (searchText = '') => {
  const intl = useIntl();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const sections = useMemo(() => {
    const currencyItems = Object.values(currencyMap);
    if (currencyItems.length === 0) {
      return [];
    }
    const section: Record<ICurrencyType, ICurrencyItem[]> = {
      'crypto': [],
      'fiat': [],
      'popular': [],
    };
    const data = currencyItems.filter((item) =>
      currencyFilterFn(searchText, item),
    );
    for (let i = 0; i < data.length; i += 1) {
      const item = data[i];
      item.type.forEach((type) => {
        if (section[type]) {
          section[type].push(item);
        }
      });
    }
    return [
      {
        title: intl.formatMessage({ id: ETranslations.global_popular }),
        data: section.popular,
      },
      {
        title: intl.formatMessage({ id: ETranslations.global_crypto }),
        data: section.crypto,
      },
      {
        title: intl.formatMessage({ id: ETranslations.settings_fiat }),
        data: section.fiat,
      },
    ].filter((item) => item.data.length > 0);
  }, [currencyMap, intl, searchText]);
  return sections;
};
