import { type FC, useCallback, useMemo, useState } from 'react';

import {
  ListItem,
  Page,
  SearchBar,
  SectionList,
  Stack,
} from '@onekeyhq/components';
import {} from '@onekeyhq/components/src/layouts/SectionList';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

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

type IListHeaderComponentProps = {
  text: string;
  onChangeText: (value: string) => void;
};
const ListHeaderComponent: FC<IListHeaderComponentProps> = ({
  text,
  onChangeText,
}) => (
  <Stack px="$4" pt="$4">
    <SearchBar value={text} onChangeText={onChangeText} />
  </Stack>
);

const emptySections: ISectionItem[] = [];
const currencyFilterFn = (keyword: string, item: ICurrencyItem) => {
  const text = keyword.toLowerCase();
  return (
    item.id.toLowerCase().includes(text) ||
    item.name.toLowerCase().includes(text)
  );
};

const CurrencyItem: FC<{ item: ICurrencyItem }> = ({ item }) => {
  const [settings] = useSettingsPersistAtom();
  const onPress = useCallback(async () => {
    await backgroundApiProxy.serviceSetting.setCurrency(item.id);
  }, [item]);
  return (
    <ListItem
      title={`${item.id.toUpperCase()} - ${item.unit}`}
      subtitle={item.name}
      checkMark={settings.currency === item.id}
      onPress={onPress}
    />
  );
};

export default function SettingCurrencyModal() {
  const [text, onChangeText] = useState('');
  const currencyListResult = usePromiseResult<ICurrencyItem[]>(async () => {
    const items = await backgroundApiProxy.serviceSetting.getCurrencyList();
    return items;
  }, []);

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
        title: 'popular',
        data: section.popular,
      },
      {
        title: 'crypto',
        data: section.crypto,
      },
      {
        title: 'fiat',
        data: section.fiat,
      },
    ].filter((item) => item.data.length > 0);
  }, [currencyListResult, text]);

  const renderItem = useCallback(
    ({ item }: { item: ICurrencyItem }) => <CurrencyItem item={item} />,
    [],
  );
  const renderSectionHeader = useCallback(
    ({ section }: { section: ISectionItem }) => (
      <SectionList.SectionHeader title={section.title} />
    ),
    [],
  );
  return (
    <Page>
      <SectionList
        estimatedItemSize="$6"
        ListHeaderComponent={
          <ListHeaderComponent text={text} onChangeText={onChangeText} />
        }
        sections={sections ?? emptySections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
      />
    </Page>
  );
}
