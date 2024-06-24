import type { FC } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { INavSearchBarProps } from '@onekeyhq/components';
import {
  Empty,
  Page,
  SearchBar,
  SectionList,
  Spinner,
  Stack,
} from '@onekeyhq/components';
import {} from '@onekeyhq/components/src/layouts/SectionList';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type ICurrencyType = 'crypto' | 'fiat' | 'popular';

export type ICurrencyItem = {
  id: string;
  unit: string;
  name: string;
  type: ICurrencyType[];
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

export default function SettingCurrencyModal() {
  const navigation = useAppNavigation();
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
  const currencyListResult = usePromiseResult<ICurrencyItem[]>(
    async () => {
      const items = await backgroundApiProxy.serviceSetting.getCurrencyList();
      return items;
    },
    [],
    { watchLoading: true },
  );

  const sections = useMemo(() => {
    if (!currencyListResult.result) {
      return [];
    }
    const section: Record<ICurrencyType, ICurrencyItem[]> = {
      'crypto': [],
      'fiat': [],
      'popular': [],
    };
    const data = currencyListResult.result?.filter((item) =>
      currencyFilterFn(text, item),
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
  }, [currencyListResult, text, intl]);

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
        {currencyListResult?.isLoading ? (
          <Stack h="$48" justifyContent="center" alignItems="center">
            <Spinner size="large" />
          </Stack>
        ) : (
          <SectionList
            estimatedItemSize="$6"
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
          />
        )}
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
