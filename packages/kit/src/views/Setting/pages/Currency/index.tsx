import type { FC } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  Page,
  SearchBar,
  SectionList,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useCurrencySections } from '@onekeyhq/kit/src/hooks/useCurrencySections';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
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
  const sections = useCurrencySections(text);
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
        void backgroundApiProxy.serviceApp.restartApp();
      });
    }
  }, [currency]);

  const disabled = useMemo(
    () => currencyRef.current.id === currency?.id,
    [currency?.id],
  );

  const handleChangeText = useCallback((searchText: string) => {
    onChangeText(searchText.trim());
  }, []);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.settings_default_currency,
        })}
      />
      <Page.Body>
        <XStack px="$5" w="100%">
          <SearchBar
            containerProps={{
              alignSelf: 'stretch',
              mb: '$4',
            }}
            size="small"
            onChangeText={handleChangeText}
            placeholder={intl.formatMessage({
              id: ETranslations.global_search,
            })}
          />
        </XStack>
        <SectionList
          estimatedItemSize={60}
          ListEmptyComponent={
            <Empty
              illustration="QuestionMark"
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
