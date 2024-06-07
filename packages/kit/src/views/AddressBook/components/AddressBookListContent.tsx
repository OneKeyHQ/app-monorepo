import { type FC, useEffect, useMemo } from 'react';
import { useCallback, useState } from 'react';

import { groupBy } from 'lodash';
import { useIntl } from 'react-intl';

import {
  ActionList,
  Empty,
  IconButton,
  SectionList,
  SizableText,
  Stack,
  useClipboard,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { buildFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes';

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
  const intl = useIntl();
  const { copyText } = useClipboard();
  const appNavigation = useAppNavigation();
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
      {showActions ? (
        <ActionList
          title={intl.formatMessage({ id: 'title__menu' })}
          items={[
            {
              label: intl.formatMessage({ id: 'action__copy' }),
              icon: 'Copy1Outline',
              onPress: async () => {
                copyText(item.address);
              },
              testID: `address-menu-copy-${item.address ?? ''}`,
            },
            {
              label: intl.formatMessage({ id: 'action__edit' }),
              icon: 'PencilOutline',
              onPress: () => {
                if (item.id) {
                  appNavigation.push(EModalAddressBookRoutes.EditItemModal, {
                    id: item.id,
                    name: item.name,
                    address: item.address,
                    networkId: item.networkId,
                  });
                }
              },
              testID: `address-menu-edit-${item.address ?? ''}`,
            },
          ]}
          renderTrigger={
            <ListItem.IconButton
              icon="DotVerSolid"
              testID={`address-menu-${item.address || ''}`}
            />
          }
        />
      ) : null}
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
      title={intl.formatMessage({ id: 'content__no_results' })}
      description="You haven't added any address yet"
      buttonProps={
        hideAddItemButton
          ? undefined
          : {
              children: intl.formatMessage({ id: 'action__add' }),
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
      title={intl.formatMessage({ id: 'content__no_results' })}
      description="No match found for your search. Try to add this contact."
      testID="address-book-search-empty"
    />
  );
};

type IAddressBookListContentProps = {
  items: IAddressNetworkItem[];
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
  showActions?: boolean;
  onPressItem?: (item: IAddressItem) => void;
  searchKey: string;
  hideEmptyAddButton?: boolean;
};

export const AddressBookListContent = ({
  items,
  onContentSizeChange,
  showActions,
  onPressItem,
  searchKey,
  hideEmptyAddButton,
}: IAddressBookListContentProps) => {
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
        index: number;
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

  return (
    <SectionList
      onContentSizeChange={onContentSizeChange}
      estimatedItemSize="$6"
      sections={memoSections}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
      SectionSeparatorComponent={null}
      ListEmptyComponent={
        items.length ? (
          RenderNoSearchResult
        ) : (
          <RenderEmptyAddressBook hideAddItemButton={hideEmptyAddButton} />
        )
      }
      keyExtractor={(item: unknown) => (item as IAddressItem).address}
    />
  );
};
