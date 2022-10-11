import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { FlatListProps, useWindowDimensions } from 'react-native';

import {
  Box,
  Center,
  HStack,
  Icon,
  Image,
  OverlayContainer,
  PresenceTransition,
  Pressable,
  Text,
  Typography,
} from '@onekeyhq/components';
import { FlatListRef } from '@onekeyhq/components/src/FlatList';
import useClickDocumentClose from '@onekeyhq/components/src/hooks/useClickDocumentClose';
import { useDropdownPosition } from '@onekeyhq/components/src/hooks/useDropdownPosition';
import { useDebounce } from '@onekeyhq/kit/src/hooks';

import DAppIcon from '../../DAppIcon';
import {
  MatchDAppItemType,
  SearchViewKeyEventType,
  SearchViewProps,
  SearchViewRef,
} from '../explorerUtils';

import { useLimitHistories } from './useLimitHistories';
import { useSearchLocalDapp } from './useSearchLocalDapp';

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

    const { limitHistories: allHistories } = useLimitHistories();

    const flatListData = useMemo(
      () => (searchContentTerm ? searchedDapps : allHistories),
      [searchContentTerm, allHistories, searchedDapps],
    );

    const renderItem: FlatListProps<MatchDAppItemType>['renderItem'] = ({
      item,
      index,
    }) => {
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
          onPress={() => {
            onSelectorItem?.(item);
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

    const win = useWindowDimensions();

    const maxHeight = useMemo(() => win.height * 0.6, [win]);

    const { domId } = useClickDocumentClose({
      name: 'SelectSearch',
      visible,
    });

    const { position, toPxPositionValue, triggerWidth } = useDropdownPosition({
      triggerEle: relativeComponent,
      contentRef: ele,
      visible,
      dropdownPosition: 'right',
      translateY,
      setPositionOnlyMounted: false,
      autoAdjust: false,
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
          onSelectorItem?.(flatListData[selectItemIndex]);
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
      onKeyPress,
    }));

    return (
      <OverlayContainer>
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
              keyExtractor={(_item: MatchDAppItemType, index) =>
                `${index}-${_item.id}`
              }
              // extraData={selectItemIndex}
              showsVerticalScrollIndicator={false}
            />
          </Box>
        </PresenceTransition>
      </OverlayContainer>
    );
  },
);

SearchView.displayName = 'SearchView';

export default SearchView;
