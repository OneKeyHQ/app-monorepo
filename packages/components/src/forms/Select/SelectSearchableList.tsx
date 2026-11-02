import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useOverlayWidthClass } from '../../hooks/useOverlayWidthClass';
import { ListView, SearchBar } from '../../layouts';
import { SizableText, Stack } from '../../primitives';

import { filterSelectItems } from './filterSelectItems';

import type { ISelectItem } from './type';
import type { ListRenderItem } from 'react-native';

export const SELECT_SEARCHABLE_PANEL_HEIGHT = 360;

const SEARCHABLE_LIST_MD_STYLE = {
  p: '$3' as const,
  minHeight: '$7' as const,
};

function selectItemKeyExtractor(item: ISelectItem, index: number) {
  return `${String(item.value)}-${item.label}-${index}`;
}

function useSelectSearch(items: ISelectItem[] | undefined) {
  const [query, setQuery] = useState('');
  const handleQueryChange = useCallback((text: string) => {
    setQuery((current) => (current === text ? current : text));
  }, []);
  const filteredItems = useMemo(
    () => filterSelectItems(items, query),
    [items, query],
  );
  return { query, handleQueryChange, filteredItems };
}

function SelectSearchField({
  autoFocus,
  onQueryChange,
  placeholder,
}: {
  autoFocus: boolean;
  onQueryChange: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <Stack px="$2" pt="$2" pb="$1.5">
      <SearchBar
        autoFocus={autoFocus}
        size="small"
        debounceInterval={0}
        onSearchTextChange={onQueryChange}
        testID="select-search"
        {...(placeholder ? { placeholder } : null)}
      />
    </Stack>
  );
}

function SelectSearchEmpty({ query }: { query: string }) {
  const intl = useIntl();
  if (!query.trim()) {
    return null;
  }
  return (
    <SizableText
      px="$2"
      py="$3"
      size="$bodyMd"
      color="$textSubdued"
      textAlign="center"
    >
      {intl.formatMessage({ id: ETranslations.global_no_results })}
    </SizableText>
  );
}

export function SelectSearchableList({
  items,
  renderItem,
  extraData,
  searchPlaceholder,
}: {
  items?: ISelectItem[];
  renderItem: ListRenderItem<ISelectItem>;
  extraData?: unknown;
  searchPlaceholder?: string;
}) {
  // Anchored popovers start at the expanded window width, including iPad.
  // Phone and medium windows stay sheets, so the field scrolls with the list.
  const isSheet = useOverlayWidthClass() !== 'expanded';
  const { query, handleQueryChange, filteredItems } = useSelectSearch(items);
  // Keep the field instance stable so a keystroke does not remount it.
  const searchField = useMemo(
    () => (
      <SelectSearchField
        autoFocus={!isSheet}
        onQueryChange={handleQueryChange}
        placeholder={searchPlaceholder}
      />
    ),
    [handleQueryChange, isSheet, searchPlaceholder],
  );
  const emptyState = useMemo(
    () => <SelectSearchEmpty query={query} />,
    [query],
  );
  const list = (
    <ListView
      data={filteredItems}
      renderItem={renderItem}
      extraData={extraData}
      keyExtractor={selectItemKeyExtractor}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={isSheet ? searchField : undefined}
      ListEmptyComponent={emptyState}
      p="$1"
      $md={SEARCHABLE_LIST_MD_STYLE}
      flex={isSheet ? undefined : 1}
    />
  );
  if (isSheet) {
    return list;
  }
  return (
    <Stack height={SELECT_SEARCHABLE_PANEL_HEIGHT} overflow="hidden">
      {searchField}
      <Stack flex={1} minHeight={0}>
        {list}
      </Stack>
    </Stack>
  );
}
