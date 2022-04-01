import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Searchbar } from '@onekeyhq/components';

import type { BrowserBarViewProps } from './type';

const Mobile: FC<BrowserBarViewProps> = ({
  searchContent,
  onSearchContentChange,
  onSearchSubmitEditing,
  onGoBack,
  onMore,
}) => {
  const intl = useIntl();

  return (
    <Box
      w="100%"
      px={7}
      h="48px"
      bg="surface-subdued"
      flexDirection="row"
      alignItems="center"
      justifyContent="space-evenly"
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
    </Box>
  );
};

export default Mobile;
