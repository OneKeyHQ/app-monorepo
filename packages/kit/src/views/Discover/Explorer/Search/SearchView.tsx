import React, { FC, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  FlatList,
  HStack,
  Icon,
  Image,
  PresenceTransition,
  Pressable,
  ScrollableFlatListProps,
  Text,
  Typography,
} from '@onekeyhq/components';
import useClickDocumentClose from '@onekeyhq/components/src/hooks/useClickDocumentClose';
import { useDropdownPosition } from '@onekeyhq/components/src/hooks/useDropdownPosition';
import { useDebounce } from '@onekeyhq/kit/src/hooks';

import DAppIcon from '../../DAppIcon';

import { useSearchHistories } from './useSearchHistories';

import type { MatchDAppItemType } from './useSearchHistories';

export type SearchViewProps = {
  visible: boolean;
  searchContent: string;
  relativeComponent: any;
  onVisibleChange?: (visible: boolean) => void;
  onSelectorItem?: (item: MatchDAppItemType) => void;
};

const SearchView: FC<SearchViewProps> = ({
  visible,
  searchContent,
  relativeComponent,
  onSelectorItem,
}) => {
  const intl = useIntl();
  const translateY = 2;

  const searchContentTerm = useDebounce(searchContent, 150);
  const ele = useRef<HTMLDivElement>(null);

  const { searchedHistories, allHistories } = useSearchHistories(
    searchContentTerm,
    searchContent,
  );

  const flatListData = useMemo(
    () => (searchContentTerm ? searchedHistories : allHistories),
    [searchContentTerm, allHistories, searchedHistories],
  );

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

      return (
        <Pressable.Item
          px={3}
          py={2}
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

            <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
              {name ?? title ?? 'Unknown'}
            </Text>
            <Typography.Body2 numberOfLines={1} color="text-subdued">
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
  }, []);

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
        <FlatList
          data={flatListData}
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
          keyExtractor={(_item: MatchDAppItemType, index) =>
            `${index}-${_item.id}`
          }
          showsVerticalScrollIndicator={false}
        />
      </Box>
    </PresenceTransition>
  );
};

export { SearchView };
