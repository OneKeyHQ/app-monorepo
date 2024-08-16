import type { FC } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { INavSearchBarProps } from '@onekeyhq/components';
import { Empty, Page, SectionList } from '@onekeyhq/components';
import {} from '@onekeyhq/components/src/layouts/SectionList';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type ICurrencyType = 'crypto' | 'fiat' | 'popular';

export type ICurrencyItem = {
  id: string;
  unit: string;
  name: string;
  type: ICurrencyType[];
  value: string;
};

type ISectionItem = {
  title: string;
  data: ICurrencyItem[];
};

const emptySections: ISectionItem[] = [];
const currencyFilterFn = (keyword: string, item: ICurrencyItem) => {
  const text = keyword.toLowerCase();
  return (
    item.id.toLowerCase().includes(text) ||
    item.name.toLowerCase().includes(text)
  );
};

const CurrencyItem: FC<{
  item: ICurrencyItem;
  currency?: ICurrencyItem;
  onPress: (item: ICurrencyItem) => void;
}> = ({ item, onPress, currency }) => {
  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);
  return (
    <ListItem
      title={`${item.id.toUpperCase()} - ${item.unit}`}
      subtitle={item.name}
      checkMark={currency?.id === item.id}
      onPress={handlePress}
    />
  );
};

const keyExtractor = (_: unknown, index: number) => `${index}`;

export default function SettingCurrencyModal() {
  const [settings] = useSettingsPersistAtom();
  const [text, onChangeText] = useState('');
  const currencyRef = useRef({
    id: settings.currencyInfo.id,
    unit: settings.currencyInfo.symbol,
  });
  const [currency, setCurrency] = useState<ICurrencyItem | undefined>(
    currencyRef.current as ICurrencyItem,
  );
  const intl = useIntl();
  const [{ currencyItems }] = useCurrencyPersistAtom();
  const sections = useMemo(() => {
    if (currencyItems.length === 0) {
      return [];
    }
    const section: Record<ICurrencyType, ICurrencyItem[]> = {
      'crypto': [],
      'fiat': [],
      'popular': [],
    };
    const data = currencyItems.filter((item) => currencyFilterFn(text, item));
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
  }, [currencyItems, text, intl]);

  const handlePress = useCallback((item: ICurrencyItem) => {
    setCurrency(item);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ICurrencyItem }) => (
      <CurrencyItem item={item} currency={currency} onPress={handlePress} />
    ),
    [currency, handlePress],
  );
  const renderSectionHeader = useCallback(
    ({ section }: { section: ISectionItem }) => (
      <SectionList.SectionHeader title={section.title} />
    ),
    [],
  );

  const handleConfirm = useCallback(async () => {
    if (currency) {
      await backgroundApiProxy.serviceSetting.setCurrency({
        id: currency.id,
        symbol: currency.unit,
      });
      setTimeout(() => {
        backgroundApiProxy.serviceApp.restartApp();
      });
    }
  }, [currency]);

  const disabled = useMemo(
    () => currencyRef.current.id === currency?.id,
    [currency?.id],
  );

  const headerSearchBarOptions = useMemo(
    () =>
      ({
        onChangeText: ({ nativeEvent }) => {
          const afterTrim = nativeEvent.text.trim();
          onChangeText(afterTrim);
        },
        placeholder: intl.formatMessage({ id: ETranslations.global_search }),
      } as INavSearchBarProps),
    [intl],
  );

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.settings_default_currency,
        })}
        headerSearchBarOptions={headerSearchBarOptions}
      />
      <Page.Body>
        <SectionList
          estimatedItemSize={60}
          ListEmptyComponent={
            <Empty
              icon="SearchOutline"
              title={intl.formatMessage({
                id: ETranslations.global_no_results,
              })}
              description={intl.formatMessage({
                id: ETranslations.global_search_no_results_desc,
              })}
            />
          }
          sections={sections ?? emptySections}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          extraData={currency}
          keyExtractor={keyExtractor}
        />
      </Page.Body>
      <Page.Footer
        onConfirm={handleConfirm}
        confirmButtonProps={{
          disabled,
        }}
      />
    </Page>
  );
}
