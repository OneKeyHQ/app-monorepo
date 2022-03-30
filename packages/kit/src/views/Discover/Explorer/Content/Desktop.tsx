import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, HStack, IconButton, Searchbar } from '@onekeyhq/components';

import type { ExplorerViewProps } from '..';

const Desktop: FC<ExplorerViewProps> = ({
  searchContent,
  onSearchContentChange,
  onSearchSubmitEditing,
  explorerContent,
  onGoBack,
  onNext,
  onRefresh,
  onMore,
  moreView,
}) => {
  const intl = useIntl();

  return (
    <Box flex="1">
      <Box bg="surface-subdued">
        <HStack
          w="100%"
          h="64px"
          px={8}
          space={3}
          flexDirection="row"
          alignItems="center"
        >
          <IconButton type="plain" name="ArrowLeftOutline" onPress={onGoBack} />
          <IconButton type="plain" name="ArrowRightOutline" onPress={onNext} />
          <IconButton type="plain" name="RefreshOutline" onPress={onRefresh} />

          <Searchbar
            flex={1}
            h="38px"
            placeholder={intl.formatMessage({
              id: 'content__search_or_enter_dapp_url',
            })}
            hiddenLeftIcon
            size="base"
            value={searchContent}
            onClear={() => onSearchContentChange?.('')}
            onChangeText={onSearchContentChange}
            onSubmitEditing={(event) => {
              onSearchContentChange?.(event.nativeEvent.text);
              onSearchSubmitEditing?.(event.nativeEvent.text);
            }}
          />

          <IconButton
            type="plain"
            name="DotsHorizontalOutline"
            onPress={onMore}
          />
        </HStack>
        {moreView}
      </Box>

      <Box flex={1}>{explorerContent}</Box>
    </Box>
  );
};

export default Desktop;
