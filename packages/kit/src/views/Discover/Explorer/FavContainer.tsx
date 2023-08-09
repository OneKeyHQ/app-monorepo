import type { FC, PropsWithChildren } from 'react';
import { useCallback } from 'react';

import { HoverContainer } from '@onekeyhq/components';
import type { HoverContainerProps } from '@onekeyhq/components/src/HoverContainer';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { selectDiscoverBookmarks } from '../../../store/selectors';

const FavContainer: FC<
  PropsWithChildren<HoverContainerProps & { url: string }>
> = ({ url, children, hoverButtonProps }) => {
  const toggleFav = useCallback(() => {
    backgroundApiProxy.serviceDiscover.toggleFavorite(url);
    hoverButtonProps?.onPress?.();
  }, [hoverButtonProps, url]);
  const bookmarks = useAppSelector(selectDiscoverBookmarks);
  const isFaved = bookmarks?.some((i) => i.url === url);
  return (
    <HoverContainer
      hoverButtonProps={{
        type: 'plain',
        position: 'absolute',
        zIndex: 1,
        pt: 0,
        pr: 0,
        pb: 0,
        pl: 0,
        iconSize: 16,
        leftIconName: isFaved ? 'StarSolid' : 'StarOutline',
        iconColor: isFaved ? 'icon-warning' : 'icon-default',
        ...hoverButtonProps,
        onPress: toggleFav,
      }}
    >
      {children}
    </HoverContainer>
  );
};

export default FavContainer;
