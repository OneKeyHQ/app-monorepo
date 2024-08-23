import { type FC, useEffect, useMemo } from 'react';
import { useCallback, useState } from 'react';

import { groupBy } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Empty,
  IconButton,
  SearchBar,
  SectionList,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { buildFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes';

import { AddressBookSectionList } from './AddressBookSectionList';
import { ListItemIconButton } from './ListItemIconButton';

import type { IAddressItem, IAddressNetworkItem } from '../type';

type IAddressNetworkExtendMatch = IAddressNetworkItem & {
  addressMatch?: IFuseResultMatch;
  nameMatch?: IFuseResultMatch;
};

export type ISectionItem = {
  title: string;
  data: IAddressNetworkExtendMatch[];
};

const getSectionTitle = (item: IAddressNetworkItem) =>
  item.networkId.startsWith('evm--') ? 'EVM' : item.network.name;

function getSectionIndex(item: ISectionItem): number {
  if (item.title.toLowerCase() === 'bitcoin') {
    return -10;
  }
  if (item.title.toLowerCase() === 'evm') {
    return -9;
  }
  return item.data[0]?.createdAt ?? 0;
}

const buildSections = (items: IAddressNetworkExtendMatch[]) => {
  const result = groupBy(items, getSectionTitle);
  return (
    Object.entries(result)
      .map((o) => ({ title: o[0], data: o[1] }))
      // pin up btc, evm to top, other impl sort by create time
      .sort((a, b) => getSectionIndex(a) - getSectionIndex(b))
  );
};

type IRenderAddressItemProps = {
  item: IAddressNetworkExtendMatch;
  onPress?: (item: IAddressItem) => void;
  showActions?: boolean;
};

const RenderAddressBookItem: FC<IRenderAddressItemProps> = ({
  item,
  onPress,
  showActions,
}) => {
  const renderAvatar = useCallback(
    () => (
      <Stack
        justifyContent="center"
        alignItems="center"
        w="$10"
        h="$10"
        borderRadius="$full"
        backgroundColor="$gray3"
      >
        <SizableText size="$bodyLgMedium">
          {item.name.slice(0, 1).toUpperCase()}
        </SizableText>
      </Stack>
    ),
    [item.name],
  );

  return (
    <ListItem
      title={item.name}
      titleMatch={item.nameMatch}
      subtitle={item.address}
      subTitleMatch={item.addressMatch}
      renderAvatar={renderAvatar}
      onPress={() => onPress?.(item)}
      testID={`address-item-${item.address || ''}`}
    >
      {showActions ? <ListItemIconButton item={item} /> : null}
    </ListItem>
  );
};

type IRenderEmptyAddressBookProps = {
  hideAddItemButton?: boolean;
};

const RenderEmptyAddressBook: FC<IRenderEmptyAddressBookProps> = ({
  hideAddItemButton,
}) => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  return (
    <Empty
      icon="SearchOutline"
      title={intl.formatMessage({
        id: ETranslations.address_book_no_results_title,
      })}
      description={intl.formatMessage({
        id: ETranslations.address_book_empty_description,
      })}
      buttonProps={
        hideAddItemButton
          ? undefined
          : {
              children: intl.formatMessage({
                id: ETranslations.address_book_add_address_title,
              }),
              onPress: () => {
                navigation.push(EModalAddressBookRoutes.AddItemModal);
              },
              testID: 'address-book-add-button',
            }
      }
    />
  );
};

const RenderNoSearchResult = () => {
  const intl = useIntl();
  return (
    <Empty
      icon="SearchOutline"
      title={intl.formatMessage({
        id: ETranslations.address_book_no_results_title,
      })}
      description={intl.formatMessage({
        id: ETranslations.address_book_no_results_description,
      })}
      testID="address-book-search-empty"
    />
  );
};

type IAddressBookListContentProps = {
  items: IAddressNetworkItem[];
  showActions?: boolean;
  onPressItem?: (item: IAddressItem) => void;
  hideEmptyAddButton?: boolean;
};

export const AddressBookListContent = ({
  items,
  showActions,
  onPressItem,
  hideEmptyAddButton,
}: IAddressBookListContentProps) => {
  const intl = useIntl();
  const [searchKey, setSearchKey] = useState('');
  const [foldItems, setFoldItems] = useState<string[]>([]);
  const onToggle = useCallback(
    (o: string) =>
      setFoldItems((prev) => {
        if (prev.includes(o)) {
          return prev.filter((v) => v !== o);
        }
        return prev.concat(o);
      }),
    [],
  );

  useEffect(() => {
    setFoldItems([]);
  }, [searchKey]);

  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: {
        title: string;
        data: IAddressNetworkExtendMatch[];
        isFold?: boolean;
      };
    }) =>
      !searchKey ? (
        <SectionList.SectionHeader
          title={section.title.toUpperCase()}
          justifyContent="space-between"
        >
          <IconButton
            size="small"
            variant="tertiary"
            testID={`address-cat-${section.title.toUpperCase()}-${
              section.isFold ? 'fold' : 'unfold'
            }`}
            icon={
              section.isFold
                ? 'ChevronRightSmallOutline'
                : 'ChevronDownSmallSolid'
            }
            onPress={() => onToggle(section.title)}
          />
        </SectionList.SectionHeader>
      ) : null,
    [onToggle, searchKey],
  );

  const renderItem = useCallback(
    ({ item }: { item: IAddressNetworkExtendMatch }) => (
      <RenderAddressBookItem
        item={item}
        showActions={showActions}
        onPress={onPressItem}
      />
    ),
    [showActions, onPressItem],
  );
  const memoSections = useMemo(() => {
    let sections: ISectionItem[] = [];
    if (searchKey) {
      const exactMatch = (match: IFuseResultMatch) => {
        const result =
          match.indices.length === 1 &&
          match.value &&
          match.indices[0][1] - match.indices[0][0] === match.value.length - 1;
        return result;
      };
      const fuse = buildFuse(items, {
        keys: ['address', 'name'],
      });
      let itemSearched = fuse.search(searchKey).map((o) => ({
        ...o.item,
        nameMatch: o.matches?.find((i) => i.key === 'name'),
        addressMatch: o.matches?.find(
          (i) => i.key === 'address' && exactMatch(i),
        ),
      }));
      // Require an exact match for address search.
      itemSearched = itemSearched.filter((o) => {
        if (!o.nameMatch && !o.addressMatch) {
          return false;
        }
        if (!o.nameMatch && o.addressMatch) {
          return exactMatch(o.addressMatch);
        }
        return true;
      });
      sections = buildSections(itemSearched);
    } else {
      sections = buildSections(items);
    }
    return sections.map((item) => {
      const isFold = foldItems.includes(item.title);
      const { data } = item;
      return {
        title: item.title,
        data: isFold ? [] : data,
        isFold,
      };
    });
  }, [foldItems, items, searchKey]);

  const media = useMedia();

  const estimatedItemSize = useMemo(() => (media.md ? 80 : 60), [media.md]);

  return (
    <Stack flex={1}>
      <Stack px="$5" pb="$2">
        <SearchBar
          placeholder={intl.formatMessage({ id: ETranslations.global_search })}
          value={searchKey}
          onChangeText={(text) => setSearchKey(text)}
        />
      </Stack>
      <AddressBookSectionList
        showsVerticalScrollIndicator={false}
        estimatedItemSize={estimatedItemSize}
        sections={memoSections}
        renderSectionHeader={renderSectionHeader}
        renderItem={renderItem}
        ListEmptyComponent={
          items.length ? (
            RenderNoSearchResult
          ) : (
            <RenderEmptyAddressBook hideAddItemButton={hideEmptyAddButton} />
          )
        }
        keyExtractor={(item: unknown) => (item as IAddressItem).address}
      />
    </Stack>
  );
};
