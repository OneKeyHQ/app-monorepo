import React, {
  FC,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { useDeepCompareMemo } from 'use-deep-compare';

import {
  Box,
  Center,
  HStack,
  Icon,
  Image,
  PresenceTransition,
  Pressable,
  ScrollableFlatListProps,
  Text,
  Typography,
} from '@onekeyhq/components';
import { FlatListRef } from '@onekeyhq/components/src/FlatList';
import useClickDocumentClose from '@onekeyhq/components/src/hooks/useClickDocumentClose';
import { useDropdownPosition } from '@onekeyhq/components/src/hooks/useDropdownPosition';
import { useDebounce } from '@onekeyhq/kit/src/hooks';

import DAppIcon from '../../DAppIcon';

import { useSearchHistories } from './useSearchHistories';

import type { SearchContentType } from '..';
import type { KeyEventType } from '../Content/Desktop';
import type { MatchDAppItemType } from './useSearchHistories';

export type SearchViewProps = {
  visible: boolean;
  searchContent: SearchContentType | undefined;
  relativeComponent: any;
  onVisibleChange?: (visible: boolean) => void;
  onSelectorItem?: (item: MatchDAppItemType) => void;
  onHoverItem?: (item: MatchDAppItemType) => void;
  forwardedRef?: any;
  onKeyPress?: (event: KeyEventType) => void;
};

const SearchView: FC<SearchViewProps> = ({
  visible,
  searchContent,
  relativeComponent,
  onSelectorItem,
  onHoverItem,
  forwardedRef,
}) => {
  const intl = useIntl();
  const translateY = 2;

  const visibleMemo = useDeepCompareMemo(() => visible, [visible]);
  const [selectItemIndex, setSelectItemIndex] = useState<number>();
  const [tempSearchContent, setTempSearchContent] = useState<string>();

  const searchContentTerm = useDebounce(tempSearchContent ?? '', 150);

  const ele = useRef<HTMLDivElement>(null);
  const flatListRef = useRef<any>(null);

  const { searchedHistories, allHistories } = useSearchHistories(
    searchContentTerm,
    searchContent?.searchContent ?? '',
  );

  const flatListData = useMemo(
    () => (searchContentTerm ? searchedHistories : allHistories),
    [searchContentTerm, allHistories, searchedHistories],
  );

  useEffect(() => {
    if (!searchContent?.dapp) {
      setTempSearchContent(searchContent?.searchContent ?? '');
    }
  }, [searchContent]);

  const onSelectHistory = (item: MatchDAppItemType) => {
    onSelectorItem?.(item);
  };

  const toggleVisible = () => {
    // onVisibleChange?.(!visible);
  };

  const renderItem: ScrollableFlatListProps<MatchDAppItemType>['renderItem'] =
    ({ item, index }) => {
      const {
        favicon: dappFavicon,
        chain,
        name,
        url: dappUrl,
      } = item.dapp || {};

      const {
        favicon: webSiteFavicon,
        title,
        url: webSiteUrl,
      } = item.webSite || {};

      const itemTitle = () => {
        const itemName = name ?? title ?? 'Unknown';
        if (itemName.length > 24) {
          return `${itemName.slice(0, 24)}...`;
        }
        return itemName;
      };

      return (
        <Pressable.Item
          focusable={selectItemIndex === index}
          px={3}
          py={2}
          borderColor={
            selectItemIndex === index
              ? 'border-success-subdued'
              : 'surface-default'
          }
          borderWidth={1}
          borderRadius={12}
          key={`${index}-${item.id}`}
          onPress={() => {
            onSelectHistory(item);
          }}
        >
          <HStack space={3} w="100%" alignItems="center">
            {(!!dappFavicon || item.dapp) && (
              <DAppIcon size={24} favicon={dappFavicon ?? ''} chain={chain} />
            )}
            {(!!webSiteFavicon || item.webSite) && (
              <Box
                width="24px"
                height="24px"
                borderRadius="8px"
                borderWidth="1px"
                borderColor="border-subdued"
              >
                <Image
                  width="24px"
                  height="24px"
                  src={webSiteFavicon ?? ''}
                  source={{ uri: webSiteFavicon }}
                  borderRadius="8px"
                  borderWidth="1px"
                  borderColor="border-subdued"
                  fallbackElement={
                    <Center w="24px" h="24px">
                      <Icon size={18} name="GlobeSolid" />
                    </Center>
                  }
                />
              </Box>
            )}

            <Text
              flexWrap="wrap"
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            >
              {itemTitle()}
            </Text>
            <Typography.Body2 flex={1} numberOfLines={1} color="text-subdued">
              {dappUrl ?? webSiteUrl}
            </Typography.Body2>
          </HStack>
        </Pressable.Item>
      );
    };

  const maxHeight = useMemo(() => {
    if (ele.current)
      return (ele.current.ownerDocument.defaultView?.innerHeight ?? 0) * 0.6;
    if (window) return window.innerHeight * 0.6;

    return 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ele.current]);

  const { domId } = useClickDocumentClose({
    name: 'SelectSearch',
    visible,
    toggleVisible,
  });

  const { position, toPxPositionValue, triggerWidth } = useDropdownPosition({
    triggerEle: relativeComponent,
    domId,
    visible,
    dropdownPosition: 'right',
    translateY,
    setPositionOnlyMounted: false,
    autoAdjust: false,
  });

  const onKeyPress = (keyEvent: KeyEventType) => {
    if (!keyEvent) return;

    if (keyEvent === 'ArrowDown') {
      if (
        selectItemIndex !== undefined &&
        selectItemIndex < flatListData.length - 1
      ) {
        setSelectItemIndex(selectItemIndex + 1);
      } else if (selectItemIndex === undefined) {
        setSelectItemIndex(0);
      }
    } else if (keyEvent === 'ArrowUp') {
      if (selectItemIndex !== undefined && selectItemIndex > 0) {
        setSelectItemIndex(selectItemIndex - 1);
      } else if (selectItemIndex === 0) {
        setSelectItemIndex(undefined);
      }
    }
  };

  useEffect(() => {
    setSelectItemIndex(undefined);
  }, [visibleMemo, tempSearchContent]);

  useEffect(() => {
    if (selectItemIndex !== undefined) {
      onHoverItem?.(flatListData[selectItemIndex]);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
      flatListRef?.current?.scrollToIndex({
        index: selectItemIndex,
        viewOffset: maxHeight / 2,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectItemIndex]);

  useImperativeHandle(forwardedRef, () => ({
    onKeyPress: (event: KeyEventType) => {
      onKeyPress(event);
    },
  }));

  return (
    <PresenceTransition
      visible={visible}
      initial={{ opacity: 0, translateY: 0 }}
      animate={{
        opacity: 1,
        translateY,
        transition: {
          duration: 150,
        },
      }}
    >
      <Box
        ref={ele}
        maxH={toPxPositionValue(maxHeight)}
        nativeID={domId}
        position="absolute"
        width={triggerWidth ? toPxPositionValue(triggerWidth + 35) : 'full'}
        left={toPxPositionValue(position.left)}
        right={toPxPositionValue(position.right)}
        bottom={toPxPositionValue(position.bottom)}
        borderRadius="12"
        bg="surface-default"
        borderColor="border-subdued"
        borderWidth={flatListData.length > 0 ? '1px' : '0px'}
        shadow="depth.3"
        overflow="hidden"
      >
        <FlatListRef
          ref={flatListRef}
          data={flatListData}
          // @ts-expect-error
          renderItem={renderItem}
          ListHeaderComponent={
            flatListData.length > 0 ? (
              <Box p={3}>
                <Typography.Subheading color="text-subdued">
                  {intl.formatMessage({
                    id: searchContentTerm
                      ? 'title__search_results'
                      : 'transaction__history',
                  })}
                </Typography.Subheading>
              </Box>
            ) : null
          }
          // @ts-expect-error
          keyExtractor={(_item: MatchDAppItemType, index) =>
            `${index}-${_item.id}`
          }
          extraData={selectItemIndex}
          showsVerticalScrollIndicator={false}
        />
      </Box>
    </PresenceTransition>
  );
};

const SearchViewRef = forwardRef<typeof SearchView, SearchViewProps>(
  ({ ...props }, ref) => <SearchView {...props} forwardedRef={ref} />,
);

SearchViewRef.displayName = 'SearchViewRef';

export default SearchViewRef;
