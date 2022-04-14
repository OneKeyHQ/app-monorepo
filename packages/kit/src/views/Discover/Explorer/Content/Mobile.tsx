import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Typography } from '@onekeyhq/components';
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
          url: searchContent,
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
          px={7}
          h="48px"
          bg="surface-subdued"
          flexDirection="row"
          alignItems="center"
        >
          <Pressable onPress={onGoBack}>
            <Icon name="ChevronLeftOutline" size={24} />
          </Pressable>

          <Pressable onPress={onSearch} flex={1} mx={7}>
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
                {searchContent ||
                  intl.formatMessage({
                    id: 'content__search',
                  })}
              </Typography.Caption>
            </Box>
          </Pressable>

          <Pressable onPress={onMore}>
            <Icon name="DotsHorizontalOutline" size={24} />
          </Pressable>
        </Box>
      )}

      {moreView}
    </Box>
  );
};

export default Mobile;
