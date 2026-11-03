import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ListView, SearchBar } from '../../layouts';
import { SizableText, Stack } from '../../primitives';

import { filterSelectItems } from './filterSelectItems';

import type { ISelectItem } from './type';
import type { IListViewRef } from '../../layouts/ListView';
import type { ListRenderItem } from 'react-native';

export const SELECT_SEARCHABLE_PANEL_HEIGHT = 360;

const DISABLED_SCROLL_POSITION_MAINTENANCE = {
  disabled: true,
  minIndexForVisible: 0,
};

const SEARCHABLE_LIST_MD_STYLE = {
  p: '$3' as const,
  minHeight: '$7' as const,
};

const SEARCHABLE_SHEET_LIST_MD_STYLE = {
  ...SEARCHABLE_LIST_MD_STYLE,
  pt: '$0' as const,
};

function selectItemKeyExtractor(item: ISelectItem) {
  return `${typeof item.value}-${String(item.value)}-${item.label}`;
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
  isSheet,
  onQueryChange,
  placeholder,
}: {
  isSheet: boolean;
  onQueryChange: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <Stack px="$2" pt={isSheet ? '$0' : '$2'} pb="$1.5">
      <SearchBar
        autoFocus={!isSheet}
        size={isSheet ? 'medium' : 'small'}
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
  isSheet,
}: {
  items?: ISelectItem[];
  renderItem: ListRenderItem<ISelectItem>;
  extraData?: unknown;
  searchPlaceholder?: string;
  isSheet: boolean;
}) {
  const { query, handleQueryChange, filteredItems } = useSelectSearch(items);
  const listRef = useRef<IListViewRef<ISelectItem> | null>(null);
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [query]);
  // Keep the field instance stable so a keystroke does not remount it.
  const searchField = useMemo(
    () => (
      <SelectSearchField
        isSheet={isSheet}
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
      ref={listRef}
      data={filteredItems}
      renderItem={renderItem}
      extraData={extraData}
      keyExtractor={selectItemKeyExtractor}
      keyboardShouldPersistTaps="handled"
      // FlashList otherwise anchors retained rows at their pre-filter position.
      maintainVisibleContentPosition={
        platformEnv.isNative ? DISABLED_SCROLL_POSITION_MAINTENANCE : undefined
      }
      ListEmptyComponent={emptyState}
      p="$1"
      $md={isSheet ? SEARCHABLE_SHEET_LIST_MD_STYLE : SEARCHABLE_LIST_MD_STYLE}
      flex={1}
    />
  );
  return (
    <Stack
      flex={isSheet ? 1 : undefined}
      height={isSheet ? undefined : SELECT_SEARCHABLE_PANEL_HEIGHT}
      minHeight={0}
      overflow="hidden"
    >
      <Stack px={isSheet ? '$3' : '$0'} flexShrink={0}>
        {searchField}
      </Stack>
      <Stack flex={1} minHeight={0}>
        {list}
      </Stack>
    </Stack>
  );
}
