import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Searchbar } from '@onekeyhq/components';

import type { ExplorerViewProps } from '..';

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

        <Searchbar
          flex={1}
          mx={7}
          h={8}
          placeholder={intl.formatMessage({
            id: 'content__search',
          })}
          hiddenLeftIcon
          size="base"
          value={searchContent}
          onClear={() => onSearchContentChange?.('')}
          onChangeText={(text) => onSearchContentChange?.(text)}
          onSubmitEditing={(event) => {
            onSearchContentChange?.(event.nativeEvent.text);
            onSearchSubmitEditing?.(event.nativeEvent.text);
          }}
        />

        <Pressable onPress={onMore}>
          <Icon name="DotsHorizontalOutline" size={24} />
        </Pressable>
        {moreView}
      </Box>
    </Box>
  );
};

export default Mobile;
