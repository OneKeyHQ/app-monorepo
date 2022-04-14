import React, { FC, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  FlatList,
  HStack,
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

import type { DAppItemType } from '../../type';

export type SearchViewProps = {
  visible: boolean;
  searchContent: string;
  relativeComponent: any;
  onVisibleChange?: (visible: boolean) => void;
  onSelectorItem?: (item: DAppItemType) => void;
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

  const onSelectHistory = (item: DAppItemType) => {
    onSelectorItem?.(item);
  };

  const toggleVisible = () => {
    // onVisibleChange?.(!visible);
  };

  const renderItem: ScrollableFlatListProps<DAppItemType>['renderItem'] = ({
    item,
    index,
  }) => (
    <Pressable.Item
      px={3}
      py={2}
      key={`${index}-${item.url}`}
      onPress={() => {
        onSelectHistory(item);
      }}
    >
      <HStack space={3} w="100%" alignItems="center">
        <DAppIcon size={24} favicon={item.favicon} chain={item.chain} />

        <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
          {item.name}
        </Text>
        <Typography.Body2 numberOfLines={1} color="text-subdued">
          {item.url}
        </Typography.Body2>
      </HStack>
    </Pressable.Item>
  );

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
          keyExtractor={(_item: DAppItemType, index) =>
            `${index}-${_item.url}-${_item.name}`
          }
          showsVerticalScrollIndicator={false}
        />
      </Box>
    </PresenceTransition>
  );
};

export { SearchView };
