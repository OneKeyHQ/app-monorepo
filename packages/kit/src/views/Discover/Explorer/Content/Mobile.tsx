import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, IconButton, Pressable, Typography } from '@onekeyhq/components';
import { setHaptics } from '@onekeyhq/kit/src/hooks/setHaptics';
import useNavigation from '@onekeyhq/kit/src/hooks/useNavigation';
import {
  DiscoverModalRoutes,
  DiscoverRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Discover';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

import type { ExplorerViewProps } from '..';
import type { MatchDAppItemType } from '../Search/useSearchHistories';

type NavigationProps = ModalScreenProps<DiscoverRoutesParams>;

const Mobile: FC<ExplorerViewProps> = ({
  searchContent,
  onSearchSubmitEditing,
  explorerContent,
  onGoBack,
  onMore,
  moreView,
  showExplorerBar,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const onSearch = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Discover,
      params: {
        screen: DiscoverModalRoutes.SearchHistoryModal,
        params: {
          url: searchContent?.searchContent,
          onSelectorItem: (item: MatchDAppItemType | string) =>
            onSearchSubmitEditing?.(item),
        },
      },
    });
  };

  return (
    <Box flex="1">
      <Box flex={1}>{explorerContent}</Box>
      {!!showExplorerBar && (
        <Box
          w="100%"
          px={6}
          h="54px"
          bg="surface-subdued"
          flexDirection="row"
          alignItems="center"
        >
          <IconButton
            onPress={onGoBack}
            name="ChevronLeftOutline"
            size="lg"
            type="plain"
          />
          <Pressable
            onPress={() => {
              setHaptics();
              onSearch();
            }}
            flex={1}
            mx={6}
          >
            <Box
              w="100%"
              h={8}
              bg="action-secondary-default"
              borderWidth="1px"
              borderColor="border-default"
              flexDirection="row"
              alignItems="center"
              px={3}
              borderRadius="12px"
            >
              <Typography.Caption
                flex={1}
                color={searchContent ? 'text-default' : 'text-subdued'}
                numberOfLines={1}
              >
                {searchContent?.searchContent
                  ? searchContent?.searchContent
                  : intl.formatMessage({
                      id: 'content__search',
                    })}
              </Typography.Caption>
            </Box>
          </Pressable>
          <IconButton
            onPress={onMore}
            name="DotsHorizontalOutline"
            size="lg"
            type="plain"
          />
        </Box>
      )}

      {moreView}
    </Box>
  );
};

export default Mobile;
