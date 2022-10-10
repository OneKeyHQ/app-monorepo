import { FC, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, IconButton, Pressable, Typography } from '@onekeyhq/components';
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

import { useWebController } from '../Controller/useWebController';
import { ExplorerViewProps, MatchDAppItemType } from '../explorerUtils';

type NavigationProps = ModalScreenProps<DiscoverRoutesParams>;

const Mobile: FC<ExplorerViewProps> = ({
  onSearchSubmitEditing,
  explorerContent,
  onGoBack,
  onMore,
  moreView,
  showExplorerBar,
}) => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { currentTab } = useWebController();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const url: string = currentTab?.url || '';
  const [searchText, setSearchText] = useState(url);

  useEffect(() => {
    setSearchText(url);
  }, [url]);

  const onSearch = () => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Discover,
      params: {
        screen: DiscoverModalRoutes.SearchHistoryModal,
        params: {
          url: searchText,
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
            disabled={url === ''}
            onPress={onGoBack}
            name="ChevronLeftOutline"
            size="lg"
            type="plain"
          />
          <Pressable
            onPress={() => {
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
                color={searchText ? 'text-default' : 'text-subdued'}
                numberOfLines={1}
              >
                {searchText ||
                  intl.formatMessage({
                    id: 'content__search',
                  })}
              </Typography.Caption>
            </Box>
          </Pressable>
          <IconButton
            onPress={() => {
              onMore?.(true);
            }}
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
