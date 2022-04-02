import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Input, Pressable } from '@onekeyhq/components';
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

type NavigationProps = ModalScreenProps<DiscoverRoutesParams>;

const Mobile: FC<ExplorerViewProps> = ({
  searchContent,
  onSearchContentChange,
  onSearchSubmitEditing,
  explorerContent,
  onGoBack,
  onMore,
  moreView,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const onSearch = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Discover,
      params: {
        screen: DiscoverModalRoutes.SearchHistoryModal,
        params: { onSelectorItem: (item) => onSearchSubmitEditing?.(item.url) },
      },
    });
  };

  return (
    <Box flex="1">
      <Box flex={1}>{explorerContent}</Box>
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
          <Input
            w="100%"
            h={8}
            textSize="Caption"
            isReadOnly
            placeholder={intl.formatMessage({
              id: 'content__search',
            })}
            value={searchContent}
            onChangeText={(text) => onSearchContentChange?.(text)}
            onSubmitEditing={(event) => {
              onSearchContentChange?.(event.nativeEvent.text);
              onSearchSubmitEditing?.(event.nativeEvent.text);
            }}
          />
        </Pressable>

        <Pressable onPress={onMore}>
          <Icon name="DotsHorizontalOutline" size={24} />
        </Pressable>
      </Box>
      {moreView}
    </Box>
  );
};

export default Mobile;
