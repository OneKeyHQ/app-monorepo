import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { AnimatePresence, MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  HStack,
  OverlayContainer,
  Pressable,
  Text,
  Typography,
} from '@onekeyhq/components';
import { FlatListRef } from '@onekeyhq/components/src/FlatList';
import useClickDocumentClose from '@onekeyhq/components/src/hooks/useClickDocumentClose';
import { useDropdownPosition } from '@onekeyhq/components/src/hooks/useDropdownPosition';
import { useDebounce } from '@onekeyhq/kit/src/hooks';

import DAppIcon from '../../DAppIcon';
import { useDiscoverHistory } from '../../hooks';
import { useSearchLocalDapp } from '../../hooks/useSearchLocalDapp';

import type { DAppItemType } from '../../type';
import type {
  SearchViewKeyEventType,
  SearchViewProps,
  SearchViewRef,
} from '../explorerUtils';
import type { FlatListProps } from 'react-native';

const SearchView = forwardRef<SearchViewRef, SearchViewProps>(
  (
    {
      visible,
      searchContent = '',
      relativeComponent,
      onSelectorItem,
      onHoverItem,
    },
    forwardedRef,
  ) => {
    const intl = useIntl();
    const translateY = 9;

    const [selectItemIndex, setSelectItemIndex] = useState<number>();

    const searchContentTerm = useDebounce(searchContent ?? '', 150);

    const ele = useRef<HTMLDivElement>(null);
    const flatListRef = useRef<any>(null);

    const { searchedDapps } = useSearchLocalDapp(
      searchContentTerm,
      searchContent,
    );

    const discoverHistory = useDiscoverHistory();

    const data = useMemo(
      () => (searchContentTerm ? searchedDapps : discoverHistory),
      [searchContentTerm, discoverHistory, searchedDapps],
    );

    const flatListData = useMemo(
      () => data.map((item) => item.dapp).filter(Boolean),
      [data],
    );

    const renderItem: FlatListProps<DAppItemType>['renderItem'] = ({
      item,
      index,
    }) => {
      const { name, url: dappUrl, logoURL } = item || {};

      const itemTitle = () => {
        const itemName = name ?? 'Unknown';
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
          onPress={() => {
            onSelectorItem?.({ id: item._id, dapp: item });
          }}
        >
          <HStack space={3} w="100%" alignItems="center">
            {logoURL ? <DAppIcon size={24} url={logoURL} /> : null}
            <Text
              flexWrap="wrap"
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            >
              {itemTitle()}
            </Text>
            <Typography.Body2 flex={1} numberOfLines={1} color="text-subdued">
              {dappUrl}
            </Typography.Body2>
          </HStack>
        </Pressable.Item>
      );
    };

    const win = useWindowDimensions();

    const maxHeight = useMemo(() => win.height * 0.6, [win]);

    const { domId } = useClickDocumentClose({
      name: 'SelectSearch',
      visible,
    });

    const { position, toPxPositionValue, triggerWidth } = useDropdownPosition({
      triggerEle: relativeComponent,
      contentRef: ele,
      visible: true,
      dropdownPosition: 'right',
      translateY,
      setPositionOnlyMounted: false,
      autoAdjust: true,
    });

    const onKeyPress = (keyEvent: SearchViewKeyEventType) => {
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
      } else if (keyEvent === 'Enter') {
        if (selectItemIndex !== undefined && flatListData.length) {
          const item = flatListData[selectItemIndex];
          onSelectorItem?.({ id: item._id, dapp: item });
        } else {
          return false;
        }
      } else {
        return false;
      }
      return true;
    };

    useEffect(() => {
      setSelectItemIndex(undefined);
    }, [searchContent]);

    useEffect(() => {
      if (selectItemIndex !== undefined) {
        const item = flatListData[selectItemIndex];
        onHoverItem?.({ id: item._id, dapp: item });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
        flatListRef?.current?.scrollToIndex({
          index: selectItemIndex,
          viewOffset: maxHeight / 2,
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectItemIndex]);

    useImperativeHandle(forwardedRef, () => ({
      onKeyPress,
    }));

    return (
      <OverlayContainer>
        {/* TODO replace all PresenceTransition */}
        <AnimatePresence>
          {visible && (
            <MotiView
              from={{ opacity: 0, translateY: 0 }}
              animate={{
                opacity: 1,
                translateY,
              }}
              transition={{
                type: 'timing',
                duration: 150,
              }}
              exit={{ opacity: 0, translateY: 0 }}
            >
              <Box
                ref={ele}
                maxH={toPxPositionValue(maxHeight)}
                nativeID={domId}
                position="absolute"
                width={
                  triggerWidth ? toPxPositionValue(triggerWidth + 35) : 'full'
                }
                left={toPxPositionValue(position.left)}
                right={toPxPositionValue(position.right)}
                top={toPxPositionValue(position.top)}
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
                  renderItem={renderItem}
                  keyboardShouldPersistTaps="handled"
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
                  keyExtractor={(item) => item._id}
                  // extraData={selectItemIndex}
                  showsVerticalScrollIndicator={false}
                />
              </Box>
            </MotiView>
          )}
        </AnimatePresence>
      </OverlayContainer>
    );
  },
);

SearchView.displayName = 'SearchView';

export default SearchView;
