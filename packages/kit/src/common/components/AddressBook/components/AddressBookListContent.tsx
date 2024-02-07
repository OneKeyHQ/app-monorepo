import { type FC, useMemo } from 'react';
import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Empty,
  IconButton,
  SectionList,
  SizableText,
  Stack,
  Toast,
  useClipboard,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';

import { EModalAddressBookRoutes } from '../router/types';

import type { IAddressItem, ISectionItem } from '../type';

type IRenderAddressItemProps = {
  item: IAddressItem;
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
      subtitle={item.address}
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
                Toast.success({
                  title: intl.formatMessage({ id: 'msg__copied' }),
                });
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
  sections: ISectionItem[];
  onContentSizeChange?: ((w: number, h: number) => void) | undefined;
  showActions?: boolean;
  onPressItem?: (item: IAddressItem) => void;
  searchKey: string;
  hideEmptyAddButton?: boolean;
};

export const AddressBookListContent = ({
  sections,
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

  const renderSectionHeader = useCallback(
    ({
      section,
    }: {
      section: {
        title: string;
        data: IAddressItem[];
        index: number;
        isFold?: boolean;
      };
    }) => (
      <SectionList.SectionHeader
        title={section.title.toUpperCase()}
        justifyContent="space-between"
      >
        {!searchKey ? (
          <IconButton
            size="small"
            variant="tertiary"
            testID={`address-cat-${section.title.toUpperCase()}-${
              section.isFold ? 'fold' : 'unfold'
            }`}
            icon={
              section.isFold
                ? 'ChevronTopSmallOutline'
                : 'ChevronDownSmallSolid'
            }
            onPress={() => onToggle(section.title)}
          />
        ) : null}
      </SectionList.SectionHeader>
    ),
    [onToggle, searchKey],
  );

  const renderItem = useCallback(
    ({ item }: { item: IAddressItem }) => (
      <RenderAddressBookItem
        item={item}
        showActions={showActions}
        onPress={onPressItem}
      />
    ),
    [showActions, onPressItem],
  );
  const memoSections = useMemo(() => {
    if (searchKey) {
      const result = sections.map((item) => {
        const data = item.data.filter(
          (o) => o.address.includes(searchKey) || o.name.includes(searchKey),
        );
        return { title: item.title, data };
      });
      return result.filter((o) => o.data.length > 0);
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
  }, [foldItems, sections, searchKey]);

  return (
    <SectionList
      onContentSizeChange={onContentSizeChange}
      estimatedItemSize="$6"
      sections={memoSections}
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
      ListEmptyComponent={
        sections.length ? (
          RenderNoSearchResult
        ) : (
          <RenderEmptyAddressBook hideAddItemButton={hideEmptyAddButton} />
        )
      }
      keyExtractor={(item: unknown) => (item as IAddressItem).address}
    />
  );
};
