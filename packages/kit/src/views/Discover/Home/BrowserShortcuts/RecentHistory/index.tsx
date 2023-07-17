import { type FC, useCallback, useContext } from 'react';

import { Box, Pressable, Typography } from '@onekeyhq/components';

import { DiscoverContext } from '../../context';
import { Favicon } from '../Favicon';

import type { MatchDAppItemType } from '../../../Explorer/explorerUtils';

type RecentHistoryProps = {
  item: MatchDAppItemType;
};

export const RecentHistory: FC<RecentHistoryProps> = ({ item }) => {
  const { onItemSelectHistory } = useContext(DiscoverContext);
  const logoURL = item.dapp?.logoURL || item.webSite?.favicon || '';
  const name = item.dapp?.name || item.webSite?.title || '';
  const url = item.dapp?.url || item.webSite?.url || '';
  const onPress = useCallback(() => {
    onItemSelectHistory({
      id: item.id,
      webSite: { title: name, url, favicon: logoURL },
    });
  }, [onItemSelectHistory, name, url, logoURL, item]);
  return (
    <Pressable onPress={onPress}>
      {({ isPressed, isHovered }) => (
        <Box
          py="2"
          borderRadius={12}
          justifyContent="center"
          alignItems="center"
        >
          <Favicon
            logoURL={logoURL}
            url={url}
            isHovered={isHovered || isPressed}
          />
          <Typography.Caption
            w="16"
            mt="2"
            numberOfLines={2}
            textAlign="center"
            noOfLines={2}
          >
            {name ?? 'Unknown'}
          </Typography.Caption>
        </Box>
      )}
    </Pressable>
  );
};
